import { useContext, useState } from "react";
import { LLMService, LLMServiceType } from "./LLMAsAService";

export interface UseLLMReturnType {
  send: Function;
  stop: Function;
  response: string; 
  idle: boolean;
  error: string;
  setResponse: Function;
}

export const useLLM = (options?: LLMServiceType): UseLLMReturnType => {
  const [response, setResponse] = useState<string>("");
  const [idle, setIdle] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  let context = useContext(LLMService);
  if (!context) {
    context = options;
  }

  if (!context) {
    throw new Error(
      "useLLM must be used within a LLMServiceProvider or constructed with options in your useLLM() call."
    );
  }

  /**
   * Stops the fetch request and returns the hook to an idle state. Use this to add abort functionality to your UI.
   * 
   * @param controller An AbortController object to stop the fetch request and return this hook to an idle state, the controller should be the same one passed to the send function.
   */
  const stop = (controller: AbortController | null) => {
    if (controller) controller.abort();
    setIdle(true);
  };

  /**
   * Calls the LLM as a service with the given prompt and messages. The response is returned in the response property of the hook.
   *
   * @param prompt The prompt to send the the LLM service.
   * @param messages The history and context messages to send to the LLM service. as an array of {role: string, content: string} objects. for example, [{ role: "system", content: "You are a useful assistant." }]
   * @param stream  Determines whether to stream results back in the response property as they return from the service or batch them up and return them all at once in the response property as a string.
   * @param abortController The AbortController used to abort this request once its started. This allows you to add a stop button to your UI.
   * @param service The service to use for the request. If null, load balancing will be applied. This is typically only used for testing.
   * @returns a StreamReader object if stream is true, otherwise a string of the response. Typically this isn't used when streaming, the stream is exposed in the response property.
   */
  async function send(
    prompt: string,
    messages = [],
    stream: boolean = true,
    abortController: AbortController = new AbortController(),
    service: string | null = null // null means use the default service and apply services load balancing
  ): Promise<ReadableStreamDefaultReader<any> | string | undefined> {
    setResponse("");
    setIdle(false);

    let errorInFetch = "";

    const responseBody = JSON.stringify({
      projectId: context?.project_id ?? "",
      serviceId: service,
      prompt: prompt,
      messages: messages,
      customer: context?.customer ?? {}, // if no customer, use the projectId as the customer_id
    });

    // trying to get cloudfront oac going. posts need to be signed, but when i add this the call fails...
    const options = {
      method: "POST",
      signal: abortController.signal,
      mode: "cors" as RequestMode,
      headers: {
        "Content-Type": "text/plain",
        //"x-Amz-Content-Sha256": sha256.create().update(responseBody).hex(),
        //"x-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
      },
      body: responseBody,
    };

    try {
      const url = context?.url ?? "https://chat.llmasaservice.io/";
      const response = await fetch(url, options);
      if (!response.ok) {
        errorInFetch = `Error: Network error for service. (${response.status} ${response.statusText})`;
      } else {
        const reader =
          response?.body?.getReader() as ReadableStreamDefaultReader;
        const decoder = new TextDecoder("utf-8");
        setIdle(false);

        if (!stream) {
          setResponse(
            await readStream(reader, decoder, stream, {
              signal: options.signal,
            })
          );
        } else {
          readStream(reader, decoder, stream, {
            signal: options.signal,
          });

          return reader;
        }
      }
    } catch (errorObject: any) {
      errorInFetch = `Error: Having trouble connecting to chat service. (${errorObject.message})`;
    }

    if (errorInFetch !== "") {
      setError(errorInFetch);
      console.error(`Error: Error in fetch. (${errorInFetch})`);
    }
  }

  async function readStream(
    reader: ReadableStreamDefaultReader,
    decoder: TextDecoder,
    stream: Boolean = true,
    { signal: signal }: { signal: AbortSignal }
  ): Promise<string> {
    let errorInRead = "";
    let result = "";

    while (true) {
      try {
        // Check if the stream has been aborted
        if (signal.aborted) {
          reader.cancel();
          setIdle(true);
          break;
        }

        // Read a chunk of data from the stream
        const { value, done } = await reader.read();

        if (decoder.decode(value).startsWith("Error:")) {
          errorInRead = decoder.decode(value).substring(6);
          break;
        }

        // If the stream has been read to the end, exit the loop
        if (done) {
          setIdle(true);
          break;
        }

        // Process the chunk of data
        result += decoder.decode(value);
        if (stream) setResponse((prevState: any) => result);
      } catch (error: any) {
        if (error.name === "AbortError") {
          break;
        }

        errorInRead = `Reading error  ${error.message}`;
        break;
      } finally {
        if (signal.aborted) {
          reader.releaseLock();
        }
      }
    }

    if (errorInRead !== "") {
      setError(errorInRead);
      reader.cancel();
      setIdle(true);
    }

    return result;
  }

  return { response, send, stop, idle, error, setResponse };
};

export default useLLM;