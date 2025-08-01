import React, { createContext, ReactNode } from "react";

export type LLMAsAServiceCustomer = {
  customer_id: string;
  tenant_id?: string;
  customer_name?: string;
  customer_user_id?: string;
  customer_user_email?: string;
  tenant_name?: string;
  tenant_billing_email?: string;
  tenant_billing_contact_name?: string;
  tenant_stripe_customer_id?: string;
  tenant_stripe_subscription_id?: string;
};

export interface LLMServiceType {
  project_id: string | undefined;
  customer?: LLMAsAServiceCustomer;
  url?: string | null;
  agent?: string | null;
  tools?: [] | null;
}

export const LLMService = createContext<LLMServiceType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  project_id: string | undefined;
  customer?: LLMAsAServiceCustomer;
  url?: string | null;
  agent?: string | null;
  tools?: [] | null;
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