import React, { createContext, ReactNode } from "react";

export type LLMAsAServiceCustomer = {
  customer_id: string;
  customer_name?: string;
  customer_user_id?: string;
  customer_user_email?: string;
};

export interface LLMServiceType {
  project_id: string | undefined;
  customer: LLMAsAServiceCustomer;
}

export const LLMService = createContext<LLMServiceType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  project_id: string | undefined;
  customer: LLMAsAServiceCustomer;
}

export const LLMServiceProvider: React.FC<UserProviderProps> = ({
  children,
  project_id,
  customer,
}) => {
  return (
    <LLMService.Provider value={{ project_id, customer }}>
      {children}
    </LLMService.Provider>
  );
};

export default LLMService;