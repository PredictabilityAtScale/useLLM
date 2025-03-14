import React, { createContext, ReactNode } from "react";

export type LLMAsAServiceCustomer = {
  customer_id: string;
  customer_name?: string;
  customer_user_id?: string;
  customer_user_email?: string;
};

export interface LLMServiceType {
  project_id: string | undefined;
  customer?: LLMAsAServiceCustomer;
  url?: string | null;
  agent?: string | null;
}

export const LLMService = createContext<LLMServiceType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  project_id: string | undefined;
  customer?: LLMAsAServiceCustomer;
  url?: string | null;
  agent?: string | null;
}

export const LLMServiceProvider: React.FC<UserProviderProps> = ({
  children,
  project_id,
  customer,
  url = "https://chat.llmasaservice.io/",
  agent = null,
}) => {
  return (
    <LLMService.Provider value={{ project_id, customer, url, agent }}>
      {children}
    </LLMService.Provider>
  );
};

export default LLMServiceProvider;