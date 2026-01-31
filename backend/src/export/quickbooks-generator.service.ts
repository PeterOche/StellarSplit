import { Injectable } from '@nestjs/common';
import { ExportJob } from './entities/export-job.entity';
import * as xml2js from 'xml2js';

@Injectable()
export class QuickBooksGeneratorService {
  /**
   * Generate QBO (QuickBooks Online) file
   */
  async generateQbo(data: any, job: ExportJob): Promise<Buffer> {
    const builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ', newline: '\n' },
    });
    
    const qboData = this.formatForQuickBooks(data, job);
    const xml = builder.buildObject(qboData);
    
    return Buffer.from(xml, 'utf8');
  }

  /**
   * Format data for QuickBooks
   */
  private formatForQuickBooks(data: any, job: ExportJob): any {
    const now = new Date();
    
    return {
      QBXML: {
        $: { version: '13.0' },
        QBXMLMsgsRq: {
          $: { onError: 'stopOnError' },
          VendorAddRq: this.formatVendors(data),
          CustomerAddRq: this.formatCustomers(data),
          AccountAddRq: this.formatAccounts(),
          ItemServiceAddRq: this.formatItems(data),
          InvoiceAddRq: this.formatInvoices(data),
          BillAddRq: this.formatBills(data),
          JournalEntryAddRq: this.formatJournalEntries(data, job),
        },
      },
    };
  }

  /**
   * Format vendor data (for people you owe money to)
   */
  private formatVendors(data: any): any[] {
    const vendors = new Map();
    
    // Extract vendors from expenses and settlements
    data.expenses.forEach((expense: any) => {
      if (expense.paidBy !== expense.userId) { // Someone else paid
        const vendorId = expense.paidBy;
        if (!vendors.has(vendorId)) {
          vendors.set(vendorId, {
            Name: expense.paidByUser?.name || `Vendor-${vendorId.substring(0, 8)}`,
            CompanyName: expense.paidByUser?.name || 'Individual',
            FirstName: expense.paidByUser?.firstName || '',
            LastName: expense.paidByUser?.lastName || '',
            VendorAddress: {
              Addr1: 'N/A',
              City: 'N/A',
              State: 'N/A',
              PostalCode: 'N/A',
              Country: 'N/A',
            },
          });
        }
      }
    });
    
    return Array.from(vendors.values()).map((vendor) => ({
      VendorAdd: vendor,
    }));
  }

  /**
   * Format customer data (for people who owe you money)
   */
  private formatCustomers(data: any): any[] {
    const customers = new Map();
    
    // Extract customers from partner summary or expenses
    if (data.partners) {
      data.partners.forEach((partner: any) => {
        if (partner.totalOwedToYou > 0) {
          customers.set(partner.partnerId, {
            Name: partner.partnerName || `Customer-${partner.partnerId.substring(0, 8)}`,
            CompanyName: partner.partnerName || 'Individual',
            FirstName: partner.partnerName?.split(' ')[0] || '',
            LastName: partner.partnerName?.split(' ').slice(1).join(' ') || '',
            CustomerAddress: {
              Addr1: 'N/A',
              City: 'N/A',
              State: 'N/A',
              PostalCode: 'N/A',
              Country: 'N/A',
            },
          });
        }
      });
    }
    
    return Array.from(customers.values()).map((customer) => ({
      CustomerAdd: customer,
    }));
  }

  /**
   * Format chart of accounts
   */
  private formatAccounts(): any[] {
    const accounts = [
      {
        Name: 'Accounts Receivable',
        AccountType: 'AccountsReceivable',
        Desc: 'Money owed to you',
      },
      {
        Name: 'Accounts Payable',
        AccountType: 'AccountsPayable',
        Desc: 'Money you owe to others',
      },
      {
        Name: 'Expense Account',
        AccountType: 'Expense',
        Desc: 'General expense account',
      },
      {
        Name: 'Income Account',
        AccountType: 'Income',
        Desc: 'Income from settlements',
      },
    ];
    
    return accounts.map((account) => ({
      AccountAdd: account,
    }));
  }

  /**
   * Format items/services
   */
  private formatItems(data: any): any[] {
    const items = new Map();
    
    // Create items based on expense categories
    data.expenses.forEach((expense: any) => {
      if (!items.has(expense.category)) {
        items.set(expense.category, {
          Name: `Service-${expense.category}`,
          SalesOrPurchase: {
            Desc: `${expense.category} expense`,
            AccountRef: {
              FullName: 'Expense Account',
            },
          },
        });
      }
    });
    
    return Array.from(items.values()).map((item) => ({
      ItemServiceAdd: item,
    }));
  }

  /**
   * Format invoices (money owed to you)
   */
  private formatInvoices(data: any): any[] {
    const invoices = [];
    
    if (data.partners) {
      data.partners.forEach((partner: any) => {
        if (partner.totalOwedToYou > 0) {
          invoices.push({
            CustomerRef: {
              FullName: partner.partnerName || `Customer-${partner.partnerId.substring(0, 8)}`,
            },
            TxnDate: new Date().toISOString().split('T')[0],
            BillAddress: {
              Addr1: 'N/A',
              City: 'N/A',
              State: 'N/A',
              PostalCode: 'N/A',
              Country: 'N/A',
            },
            InvoiceLineAdd: [{
              ItemRef: {
                FullName: 'Service-General',
              },
              Desc: 'Amount owed from shared expenses',
              Quantity: 1,
              Rate: partner.totalOwedToYou,
            }],
          });
        }
      });
    }
    
    return invoices.map((invoice) => ({
      InvoiceAdd: invoice,
    }));
  }

  /**
   * Format bills (money you owe)
   */
  private formatBills(data: any): any[] {
    const bills = [];
    
    if (data.partners) {
      data.partners.forEach((partner: any) => {
        if (partner.totalYouOwe > 0) {
          bills.push({
            VendorRef: {
              FullName: partner.partnerName || `Vendor-${partner.partnerId.substring(0, 8)}`,
            },
            TxnDate: new Date().toISOString().split('T')[0],
            DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            ExpenseLineAdd: [{
              AccountRef: {
                FullName: 'Accounts Payable',
              },
              Amount: partner.totalYouOwe,
              Memo: 'Amount owed for shared expenses',
            }],
          });
        }
      });
    }
    
    return bills.map((bill) => ({
      BillAdd: bill,
    }));
  }

  /**
   * Format journal entries for all transactions
   */
  private formatJournalEntries(data: any, job: ExportJob): any[] {
    const journalEntries = [];
    
    // Add expenses as journal entries
    data.expenses.forEach((expense: any) => {
      const entry = {
        TxnDate: new Date(expense.createdAt).toISOString().split('T')[0],
        JournalCreditLine: [],
        JournalDebitLine: [],
      };
      
      // Debit: Expense account
      entry.JournalDebitLine.push({
        AccountRef: {
          FullName: 'Expense Account',
        },
        Amount: expense.amount,
        Memo: expense.description,
        EntityRef: {
          FullName: expense.paidByUser?.name || 'Self',
        },
      });
      
      // Credit: Accounts Payable or Accounts Receivable
      expense.participants.forEach((participant: any) => {
        if (participant.amount > 0) {
          const line = {
            AccountRef: {
              FullName: expense.paidBy === expense.userId ? 'Accounts Receivable' : 'Accounts Payable',
            },
            Amount: participant.amount,
            Memo: `Share of ${expense.description}`,
            EntityRef: {
              FullName: participant.user?.name || `User-${participant.userId.substring(0, 8)}`,
            },
          };
          entry.JournalCreditLine.push(line);
        }
      });
      
      journalEntries.push(entry);
    });
    
    // Add settlements as journal entries
    data.settlements.forEach((settlement: any) => {
      const entry = {
        TxnDate: new Date(settlement.createdAt).toISOString().split('T')[0],
        JournalCreditLine: [],
        JournalDebitLine: [],
      };
      
      if (settlement.direction === 'incoming') {
        // Received payment
        entry.JournalDebitLine.push({
          AccountRef: { FullName: 'Bank Account' },
          Amount: settlement.amount,
          Memo: settlement.description,
        });
        entry.JournalCreditLine.push({
          AccountRef: { FullName: 'Accounts Receivable' },
          Amount: settlement.amount,
          Memo: `Payment from ${settlement.counterpartyName}`,
        });
      } else {
        // Made payment
        entry.JournalDebitLine.push({
          AccountRef: { FullName: 'Accounts Payable' },
          Amount: settlement.amount,
          Memo: `Payment to ${settlement.counterpartyName}`,
        });
        entry.JournalCreditLine.push({
          AccountRef: { FullName: 'Bank Account' },
          Amount: settlement.amount,
          Memo: settlement.description,
        });
      }
      
      journalEntries.push(entry);
    });
    
    // Add tax entries if tax compliant
    if (job.isTaxCompliant) {
      const taxEntry = {
        TxnDate: new Date().toISOString().split('T')[0],
        JournalCreditLine: [],
        JournalDebitLine: [],
      };
      
      const deductibleAmount = data.summary?.deductibleAmount || 0;
      const taxableIncome = data.summary?.taxableIncome || 0;
      
      if (deductibleAmount > 0) {
        taxEntry.JournalDebitLine.push({
          AccountRef: { FullName: 'Tax Deductions' },
          Amount: deductibleAmount,
          Memo: 'Business expense deductions',
        });
      }
      
      if (taxableIncome > 0) {
        taxEntry.JournalCreditLine.push({
          AccountRef: { FullName: 'Taxable Income' },
          Amount: taxableIncome,
          Memo: 'Income from expense settlements',
        });
      }
      
      journalEntries.push(taxEntry);
    }
    
    return journalEntries.map((entry) => ({
      JournalEntryAdd: entry,
    }));
  }
}