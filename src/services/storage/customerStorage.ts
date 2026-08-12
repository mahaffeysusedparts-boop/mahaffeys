import { Customer } from "@/types/scrap";
import { sharedStorage } from "@/services/sharedStorage";
import { INITIAL_CUSTOMERS } from "@/services/data/initialData";

const KEY = 'mahaffeys_customers';

export const customerStorage = {
  getCustomers(): Customer[] {
    const data = sharedStorage.getItem(KEY);
    if (!data) {
      sharedStorage.setItem(KEY, JSON.stringify(INITIAL_CUSTOMERS));
      return INITIAL_CUSTOMERS;
    }
    return JSON.parse(data);
  },

  saveCustomer(customer: Customer): Customer {
    const customers = this.getCustomers();
    const existingIndex = customers.findIndex((c) => c.id === customer.id);
    if (existingIndex >= 0) {
      customers[existingIndex] = customer;
    } else {
      customers.unshift(customer);
    }
    sharedStorage.setItem(KEY, JSON.stringify(customers));
    return customer;
  },
};