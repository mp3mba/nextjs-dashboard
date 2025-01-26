const connectionPool = require('../../db');

import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

export async function fetchRevenue(): Promise<Revenue[]> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    const result = await connectionPool.query('SELECT * FROM revenue');

    const data: Revenue[] = result.rows.map((row: any) => ({
      month: row.month,
      revenue: Number(row.revenue), // Ensure proper type conversion
    }));

    return data
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const result = await connectionPool.query(`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`);

    const latestInvoices = result.rows.map((invoice: any) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // Execute queries in parallel
    const [invoiceCountResult, customerCountResult, invoiceStatusResult] = await Promise.all([
      connectionPool.query('SELECT COUNT(*) AS count FROM invoices'),
      connectionPool.query('SELECT COUNT(*) AS count FROM customers'),
      connectionPool.query(`
        SELECT
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
        FROM invoices
      `),
    ]);

    // Extract and map results
    const numberOfInvoices = Number(invoiceCountResult.rows[0]?.count ?? '0');
    const numberOfCustomers = Number(customerCountResult.rows[0]?.count ?? '0');
    const totalPaidInvoices = formatCurrency(Number(invoiceStatusResult.rows[0]?.paid ?? '0'));
    const totalPendingInvoices = formatCurrency(Number(invoiceStatusResult.rows[0]?.pending ?? '0'));

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string,  currentPage: number): Promise<InvoicesTable[]> {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {

    const result = await connectionPool.query(`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1
      ORDER BY invoices.date DESC
      LIMIT $2 OFFSET $3
    `, [`%${query}%`, ITEMS_PER_PAGE, offset]);
    
    const invoices = result.rows as InvoicesTable[];
    

    return invoices
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await connectionPool.query(`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE '${`%${query}%`}' OR
      customers.email ILIKE '${`%${query}%`}' OR
      invoices.amount::text ILIKE '${`%${query}%`}' OR
      invoices.date::text ILIKE '${`%${query}%`}' OR
      invoices.status ILIKE '${`%${query}%`}'
  `);

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string): Promise<InvoiceForm | null> {
  try {

    const result = await connectionPool.query(
      `
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = $1;
      `,
      [id],
    );
    
    // Explicitly type the result rows
    const invoice = result.rows[0] ?? null;
    // const invoice = result.rows[0] as InvoiceForm | undefined;
    

    // if (result.rows.length === 0) {
    //   return null; // Return null if no invoice is found
    // }

    // const invoice = result.rows[0];

    // Convert amount from cents to dollars
    return {
      ...invoice,
      amount: invoice.amount / 100,
    };

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}


export async function fetchCustomers(): Promise<CustomerField[]> {
  try {
    const data = await connectionPool.query(`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `);

    const customers = data.rows as CustomerField[]; // Explicitly cast rows
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string): Promise<CustomersTableType[]> {
  try {
    const data = await connectionPool.query(`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image_url,
        COUNT(invoices.id) AS total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices ON customers.id = invoices.customer_id
      WHERE
        customers.name ILIKE $1 OR
        customers.email ILIKE $1
      GROUP BY customers.id, customers.name, customers.email, customers.image_url
      ORDER BY customers.name ASC
    `, [`%${query}%`]);

    // Explicitly cast `data.rows` to `CustomersTableType[]`
    const customerData = data.rows as CustomersTableType[];

    const customers = customerData.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return invoice[0];
    
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

