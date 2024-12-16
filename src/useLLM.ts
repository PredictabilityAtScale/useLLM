import { useContext, useState } from "react";
import { LLMService, LLMServiceType } from "./LLMAsAService";

export interface UseLLMReturnType {
  send: Function;
  stop: Function;
  response: string;
  idle: boolean;
  error: string;
  setResponse: Function;
  lastCallId: string;
}

export const useLLM = (options?: LLMServiceType): UseLLMReturnType => {
  const [response, setResponse] = useState<string>("");
  const [idle, setIdle] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [lastCallId, setLastCallId] = useState<string>("");

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
 * @param {string} prompt - The prompt to send to the LLM service.
 * @param {Array<{role: string, content: string}>} messages - The history and context messages to send to the LLM service, as an array of {role: string, content: string} objects. For example, [{ role: "system", content: "You are a useful assistant." }]
 * @param {Array<{key: string, data: string}>} data - The data to send to the LLM service, as an array of {key: string, data: string} objects. For example, [{ key: "name", value: "John" }]
 * @param {boolean} stream - Determines whether to stream results back in the response property as they return from the service or batch them up and return them all at once in the response property as a string.
 * @param {boolean} allowCaching - Determines whether the service can use cached results or not.
 * @param {string | null} service - The service to use for the request. If null, load balancing will be applied. This is typically only used for testing.
 * @param {string | null} agent - The agent that made this request.
 * @param {AbortController} abortController - The AbortController used to abort this request once it's started. This allows you to add a stop button to your UI.
 * @param {(result: string) => void} onComplete - The callback function to be called once the stream completes, with the final result string.
 * @param {(error: string) => void} onError - The callback function to be called if an error occurs, with the error string.
 * @returns {Promise<ReadableStreamDefaultReader<any> | string | undefined>} - A StreamReader object if stream is true, otherwise a string of the response. Typically this isn't used when streaming, the stream is exposed in the response property.
 */
  async function send(
    prompt: string,
    messages = [],
    data = [],
    stream: boolean = true,
    allowCaching: boolean = true,
    service: string | null = null, // null means use the default service and apply services load balancing
    agent: string | null = null,
    abortController: AbortController = new AbortController(),
    onComplete?: (result: string) => void,
    onError?: (error: string) => void
  ): Promise<ReadableStreamDefaultReader<any> | string | undefined> {
    setResponse("");
    setIdle(false);

    let errorInFetch = "";

    const responseBody = JSON.stringify({
      projectId: context?.project_id ?? "",
      serviceId: service,
      agentId: agent,
      prompt: prompt,
      messages: messages,
      data: data,
      customer: context?.customer ?? {}, // if no customer, use the projectId as the customer_id
      allowCaching: allowCaching,
    });

    // trying to get cloudfront oac going. posts need to be signed, but when i add this the call fails...
    const options = {
      method: "POST",
      signal: abortController.signal,
      mode: "cors" as RequestMode,
      headers: {
        "Content-Type": "text/plain",
      },
      body: responseBody,
    };

    try {
      const url = context?.url ?? "https://chat.llmasaservice.io/";
      const response = await fetch(url, options);
      if (!response.ok) {
        errorInFetch = `Error: Network error for service. (${response.status} ${response.statusText})`;
      } else {
        setLastCallId(response.headers.get("x-callId") ?? "");
        const reader =
          response?.body?.getReader() as ReadableStreamDefaultReader;
        const decoder = new TextDecoder("utf-8");
        setIdle(false);

        if (!stream) {
          return await readStream(
            reader,
            decoder,
            stream,
            {
              signal: options.signal,
            },
            onComplete,
            onError
          );
        } else {
          readStream(
            reader,
            decoder,
            stream,
            {
              signal: options.signal,
            },
            onComplete,
            onError
          );

          return reader;
        }
      }
    } catch (errorObject: any) {
      errorInFetch = `Error: Having trouble connecting to chat service. (${errorObject.message})`;
    }

    if (errorInFetch !== "") {
      setError(errorInFetch);
      if (onError) {
        onError(errorInFetch);
      }
      console.error(`Error: Error in fetch. (${errorInFetch})`);
    }
  }

  async function readStream(
    reader: ReadableStreamDefaultReader,
    decoder: TextDecoder,
    stream: Boolean = true,
    { signal: signal }: { signal: AbortSignal },
    onComplete?: (result: string) => void,
    onError?: (error: string) => void
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
      if (onError) onError(errorInRead);
      setIdle(true);
    }

    if (onComplete) {
      onComplete(result);
    }

    return result;
  }

  return { response, send, stop, idle, error, setResponse, lastCallId };
};

export default useLLM;
