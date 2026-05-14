export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface Contract {
  id: string;
  title: string;
  customer_name: string;
  status: ContractStatus;
  created_at: string; // ISO 8601 UTC
  content: string;
}

export type ContractInput = Omit<Contract, 'id' | 'created_at'>;
