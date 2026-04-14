export interface Order {
  id: number;
  external_id: string;
  number: string;
  total_sum: number;
  created_at: string;
  status: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  delivery_address: string | null;
  items_count: number | null;
  items_summary: string | null;
}
