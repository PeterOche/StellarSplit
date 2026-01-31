import { Injectable } from '@nestjs/common';
import { createObjectCsvWriter } from 'csv-writer';
import { ExportJob, ReportType } from './entities/export-job.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class CsvGeneratorService {
  /**
   * Generate CSV file
   */
  async generateCsv(data: any, job: ExportJob): Promise<Buffer> {
    let records: any[] = [];
    let headers: any[] = [];

    switch (job.reportType) {
      case ReportType.MONTHLY_SUMMARY:
        records = data.monthlyData;
        headers = [
          { id: 'month', title: 'Month' },
          { id: 'totalAmount', title: 'Total Amount' },
          { id: 'expenseCount', title: 'Number of Expenses' },
          { id: 'settlementAmount', title: 'Settlement Amount' },
          { id: 'settlements', title: 'Number of Settlements' },
        ];
        break;

      case ReportType.ANNUAL_TAX_REPORT:
        records = [
          ...data.businessExpenses.map((expense) => ({
            type: 'Business Expense',
            date: expense.createdAt,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            category: expense.category,
          })),
          ...data.personalExpenses.map((expense) => ({
            type: 'Personal Expense',
            date: expense.createdAt,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            category: expense.category,
          })),
          ...data.incomeFromSettlements.map((settlement) => ({
            type: 'Income (Settlement)',
            date: settlement.createdAt,
            description: settlement.description,
            amount: settlement.amount,
            currency: settlement.currency,
            counterparty: settlement.counterpartyName,
          })),
          ...data.paymentsMade.map((settlement) => ({
            type: 'Payment Made',
            date: settlement.createdAt,
            description: settlement.description,
            amount: settlement.amount,
            currency: settlement.currency,
            counterparty: settlement.counterpartyName,
          })),
        ];
        headers = [
          { id: 'type', title: 'Type' },
          { id: 'date', title: 'Date' },
          { id: 'description', title: 'Description' },
          { id: 'amount', title: 'Amount' },
          { id: 'currency', title: 'Currency' },
          { id: 'category', title: 'Category' },
          { id: 'counterparty', title: 'Counterparty' },
        ];
        break;

      case ReportType.CATEGORY_BREAKDOWN:
        records = data.categories;
        headers = [
          { id: 'category', title: 'Category' },
          { id: 'totalAmount', title: 'Total Amount' },
          { id: 'expenseCount', title: 'Number of Expenses' },
          { id: 'averageAmount', title: 'Average Amount' },
          { id: 'percentage', title: 'Percentage' },
        ];
        break;

      case ReportType.PARTNER_WISE_SUMMARY:
        records = data.partners;
        headers = [
          { id: 'partnerName', title: 'Partner Name' },
          { id: 'totalOwedToYou', title: 'Total Owed to You' },
          { id: 'totalYouOwe', title: 'Total You Owe' },
          { id: 'netBalance', title: 'Net Balance' },
          { id: 'expenseCount', title: 'Number of Expenses' },
          { id: 'lastInteraction', title: 'Last Interaction' },
        ];
        break;

      case ReportType.PAYMENT_HISTORY:
        records = data.timeline;
        headers = [
          { id: 'type', title: 'Type' },
          { id: 'date', title: 'Date' },
          { id: 'description', title: 'Description' },
          { id: 'amount', title: 'Amount' },
          { id: 'currency', title: 'Currency' },
          { id: 'category', title: 'Category' },
          { id: 'direction', title: 'Direction' },
          { id: 'counterparty', title: 'Counterparty' },
        ];
        break;

      default:
        // Custom/transaction list
        records = [
          ...data.expenses.map((expense) => ({
            type: 'Expense',
            id: expense.id,
            date: expense.createdAt,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            category: expense.category,
            paidBy: expense.paidByUser?.name || expense.paidBy,
            participants: expense.participants
              .map((p) => `${p.user?.name || p.userId}: ${p.amount} ${expense.currency}`)
              .join('; '),
            receipt: expense.receipt?.url || 'No receipt',
            settled: expense.isSettled ? 'Yes' : 'No',
          })),
          ...data.settlements.map((settlement) => ({
            type: 'Settlement',
            id: settlement.id,
            date: settlement.createdAt,
            description: settlement.description,
            amount: settlement.amount,
            currency: settlement.currency,
            direction: settlement.direction,
            counterparty: settlement.counterpartyName,
            transactionHash: settlement.transactionHash,
            status: settlement.status,
          })),
        ];
        headers = [
          { id: 'type', title: 'Transaction Type' },
          { id: 'id', title: 'ID' },
          { id: 'date', title: 'Date' },
          { id: 'description', title: 'Description' },
          { id: 'amount', title: 'Amount' },
          { id: 'currency', title: 'Currency' },
          { id: 'category', title: 'Category' },
          { id: 'paidBy', title: 'Paid By' },
          { id: 'participants', title: 'Participants' },
          { id: 'receipt', title: 'Receipt' },
          { id: 'settled', title: 'Settled' },
          { id: 'direction', title: 'Direction' },
          { id: 'counterparty', title: 'Counterparty' },
          { id: 'transactionHash', title: 'Transaction Hash' },
          { id: 'status', title: 'Status' },
        ];
    }

    // Add tax fields if required
    if (job.isTaxCompliant) {
      headers.push(
        { id: 'taxCategory', title: 'Tax Category' },
        { id: 'deductible', title: 'Deductible' },
        { id: 'taxRate', title: 'Tax Rate' },
        { id: 'taxAmount', title: 'Tax Amount' },
      );

      records = records.map((record) => ({
        ...record,
        taxCategory: this.getTaxCategory(record.category),
        deductible: this.isDeductible(record.category) ? 'Yes' : 'No',
        taxRate: '0%', // This would be calculated based on tax rules
        taxAmount: '0', // This would be calculated
      }));
    }

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: 'temp.csv',
      header: headers,
    });

    // Write to temporary file and get buffer
    await csvWriter.writeRecords(records);
    const fs = require('fs');
    const buffer = fs.readFileSync('temp.csv');
    fs.unlinkSync('temp.csv');

    return buffer;
  }

  /**
   * Generate XLSX file
   */
  async generateXlsx(data: any, job: ExportJob): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export Data');

    // Generate CSV first, then convert to XLSX
    const csvData = await this.generateCsv(data, job);
    const csvString = csvData.toString();
    const rows = csvString.split('\n');

    // Add rows to worksheet
    rows.forEach((row, rowIndex) => {
      const columns = row.split(',');
      worksheet.addRow(columns);
    });

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Add summary sheet if needed
    if (data.summary) {
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Export Summary']);
      summarySheet.addRow(['Generated At', new Date().toISOString()]);
      summarySheet.addRow(['Report Type', job.reportType]);
      summarySheet.addRow(['Total Amount', data.summary.totalAmount]);
      summarySheet.addRow(['Total Expenses', data.summary.totalExpenses]);
      summarySheet.addRow(['Total Settlements', data.summary.totalSettlements]);

      if (data.summary.currencyBreakdown) {
        summarySheet.addRow([]);
        summarySheet.addRow(['Currency Breakdown']);
        Object.entries(data.summary.currencyBreakdown).forEach(([currency, amount]) => {
          summarySheet.addRow([currency, amount]);
        });
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Get tax category for expense
   */
  private getTaxCategory(category: string): string {
    const taxCategories = {
      food: 'Meals & Entertainment',
      transportation: 'Travel',
      entertainment: 'Meals & Entertainment',
      business: 'Business Expense',
      office: 'Office Expense',
      travel: 'Travel',
      equipment: 'Capital Equipment',
      education: 'Professional Development',
      professional: 'Professional Fees',
      personal: 'Personal',
    };

    return taxCategories[category] || 'Other';
  }

  /**
   * Check if expense category is deductible
   */
  private isDeductible(category: string): boolean {
    const deductibleCategories = [
      'business',
      'office',
      'travel',
      'equipment',
      'education',
      'professional',
    ];
    return deductibleCategories.includes(category);
  }
}