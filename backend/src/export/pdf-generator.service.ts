import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { ExportJob, ReportType } from './entities/export-job.entity';

@Injectable()
export class PdfGeneratorService {
  /**
   * Generate PDF report
   */
  async generatePdf(data: any, job: ExportJob): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Generate PDF content based on report type
      this.generatePdfContent(doc, data, job);

      doc.end();
    });
  }

  /**
   * Generate PDF content based on report type
   */
  private generatePdfContent(doc: PDFKit.PDFDocument, data: any, job: ExportJob): void {
    // Add header
    this.addHeader(doc, job);

    // Add title
    this.addTitle(doc, job);

    // Add summary section
    if (data.summary && job.metadata?.settings?.includeSummary !== false) {
      this.addSummarySection(doc, data.summary);
    }

    // Add main content based on report type
    switch (job.reportType) {
      case ReportType.MONTHLY_SUMMARY:
        this.addMonthlySummary(doc, data);
        break;
      case ReportType.ANNUAL_TAX_REPORT:
        this.addTaxReport(doc, data);
        break;
      case ReportType.CATEGORY_BREAKDOWN:
        this.addCategoryBreakdown(doc, data);
        break;
      case ReportType.PARTNER_WISE_SUMMARY:
        this.addPartnerSummary(doc, data);
        break;
      case ReportType.PAYMENT_HISTORY:
        this.addPaymentHistory(doc, data);
        break;
      default:
        this.addTransactionList(doc, data);
    }

    // Add footer
    this.addFooter(doc, job);

    // Add page numbers
    this.addPageNumbers(doc);
  }

  /**
   * Add header with logo and company info
   */
  private addHeader(doc: PDFKit.PDFDocument, job: ExportJob): void {
    const logoUrl = job.metadata?.settings?.logoUrl;
    const companyName = job.metadata?.settings?.companyName || 'StellarSplit';

    doc.fontSize(20).fillColor('#333333');
    
    if (logoUrl) {
      // In production, you would download and embed the logo
      doc.text(companyName, 50, 50);
    } else {
      doc.text(companyName, 50, 50);
    }

    doc.fontSize(10).fillColor('#666666');
    doc.text('Expense Report', 50, 75);
    
    // Add tax info if applicable
    if (job.isTaxCompliant && job.metadata?.settings?.taxId) {
      doc.text(`Tax ID: ${job.metadata.settings.taxId}`, 400, 75, { align: 'right' });
    }

    doc.moveDown(2);
  }

  /**
   * Add report title
   */
  private addTitle(doc: PDFKit.PDFDocument, job: ExportJob): void {
    const titles = {
      [ReportType.MONTHLY_SUMMARY]: 'Monthly Expense Summary',
      [ReportType.ANNUAL_TAX_REPORT]: `Annual Tax Report ${job.taxYear || new Date().getFullYear()}`,
      [ReportType.CATEGORY_BREAKDOWN]: 'Expense Category Breakdown',
      [ReportType.PARTNER_WISE_SUMMARY]: 'Partner-wise Expense Summary',
      [ReportType.PAYMENT_HISTORY]: 'Payment History Report',
      [ReportType.CUSTOM]: 'Custom Expense Report',
    };

    doc.fontSize(16).fillColor('#000000');
    doc.text(titles[job.reportType] || 'Expense Report', 50, 120);
    
    // Add date range if applicable
    if (job.filters?.startDate || job.filters?.endDate) {
      doc.fontSize(10).fillColor('#666666');
      const start = job.filters.startDate ? new Date(job.filters.startDate).toLocaleDateString() : 'Beginning';
      const end = job.filters.endDate ? new Date(job.filters.endDate).toLocaleDateString() : 'Present';
      doc.text(`Period: ${start} to ${end}`, 50, 145);
    }

    doc.moveDown(2);
  }

  /**
   * Add summary section
   */
  private addSummarySection(doc: PDFKit.PDFDocument, summary: any): void {
    doc.fontSize(12).fillColor('#333333');
    doc.text('Summary', 50, doc.y);
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#000000');
    
    // Create summary table
    const startX = 50;
    let currentY = doc.y;
    
    // Row 1
    doc.text('Total Amount:', startX, currentY);
    doc.text(`${this.formatCurrency(summary.totalAmount)}`, startX + 200, currentY, { align: 'right' });
    
    currentY += 20;
    doc.text('Total Expenses:', startX, currentY);
    doc.text(summary.totalExpenses.toString(), startX + 200, currentY, { align: 'right' });
    
    currentY += 20;
    doc.text('Total Settlements:', startX, currentY);
    doc.text(summary.totalSettlements.toString(), startX + 200, currentY, { align: 'right' });
    
    currentY += 20;
    doc.text('Settlement Amount:', startX, currentY);
    doc.text(`${this.formatCurrency(summary.settlementAmount)}`, startX + 200, currentY, { align: 'right' });
    
    doc.moveTo(startX, currentY + 10).lineTo(startX + 250, currentY + 10).stroke('#CCCCCC');
    
    doc.y = currentY + 30;
  }

  /**
   * Add monthly summary content
   */
  private addMonthlySummary(doc: PDFKit.PDFDocument, data: any): void {
    doc.fontSize(12).fillColor('#333333');
    doc.text('Monthly Breakdown', 50, doc.y);
    doc.moveDown(0.5);

    const headers = ['Month', 'Expenses', 'Amount', 'Settlements', 'Settlement Amount'];
    const columnWidths = [100, 80, 80, 80, 100];
    
    this.addTableHeader(doc, headers, columnWidths);
    
    let currentY = doc.y;
    
    data.monthlyData.forEach((month: any) => {
      if (currentY > 700) { // Check if we need new page
        doc.addPage();
        currentY = 50;
        this.addTableHeader(doc, headers, columnWidths);
        currentY = doc.y;
      }
      
      doc.fontSize(9).fillColor('#000000');
      doc.text(month.month, 50, currentY);
      doc.text(month.expenseCount.toString(), 150, currentY);
      doc.text(this.formatCurrency(month.totalAmount), 230, currentY);
      doc.text(month.settlements.toString(), 310, currentY);
      doc.text(this.formatCurrency(month.settlementAmount), 390, currentY);
      
      currentY += 20;
      doc.y = currentY;
    });
    
    doc.moveDown(2);
  }

  /**
   * Add tax report content
   */
  private addTaxReport(doc: PDFKit.PDFDocument, data: any): void {
    // Business Expenses Section
    doc.fontSize(12).fillColor('#333333');
    doc.text('Business Expenses (Deductible)', 50, doc.y);
    doc.moveDown(0.5);
    
    if (data.businessExpenses.length > 0) {
      const headers = ['Date', 'Description', 'Category', 'Amount'];
      const columnWidths = [80, 150, 100, 80];
      
      this.addTableHeader(doc, headers, columnWidths);
      
      let currentY = doc.y;
      let totalBusiness = 0;
      
      data.businessExpenses.forEach((expense: any) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          this.addTableHeader(doc, headers, columnWidths);
          currentY = doc.y;
        }
        
        doc.fontSize(9).fillColor('#000000');
        doc.text(new Date(expense.createdAt).toLocaleDateString(), 50, currentY);
        doc.text(expense.description.substring(0, 30) + '...', 130, currentY);
        doc.text(expense.category, 280, currentY);
        doc.text(this.formatCurrency(expense.amount), 380, currentY, { align: 'right' });
        
        totalBusiness += expense.amount;
        currentY += 20;
        doc.y = currentY;
      });
      
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333333');
      doc.text(`Total Business Expenses: ${this.formatCurrency(totalBusiness)}`, 380, doc.y, { align: 'right' });
    } else {
      doc.fontSize(10).fillColor('#666666');
      doc.text('No business expenses found', 50, doc.y);
    }
    
    doc.moveDown(2);
    
    // Tax Summary
    doc.fontSize(12).fillColor('#333333');
    doc.text('Tax Summary', 50, doc.y);
    doc.moveDown(0.5);
    
    const taxSummary = [
      ['Total Business Expenses:', this.formatCurrency(data.summary.totalBusinessExpenses)],
      ['Total Personal Expenses:', this.formatCurrency(data.summary.totalPersonalExpenses)],
      ['Total Income from Settlements:', this.formatCurrency(data.summary.totalIncome)],
      ['Total Payments Made:', this.formatCurrency(data.summary.totalPayments)],
      ['Deductible Amount:', this.formatCurrency(data.summary.deductibleAmount)],
      ['Taxable Income:', this.formatCurrency(data.summary.taxableIncome)],
    ];
    
    let currentY2 = doc.y;
    taxSummary.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#000000');
      doc.text(label, 50, currentY2);
      doc.text(value, 380, currentY2, { align: 'right' });
      currentY2 += 20;
    });
    
    doc.y = currentY2 + 10;
    
    // Disclaimer
    doc.fontSize(8).fillColor('#FF0000');
    doc.text('IMPORTANT: This report is for informational purposes only. Please consult with a tax professional for accurate tax filing.', 50, doc.y, { width: 400 });
  }

  /**
   * Add category breakdown content
   */
  private addCategoryBreakdown(doc: PDFKit.PDFDocument, data: any): void {
    doc.fontSize(12).fillColor('#333333');
    doc.text('Expense Categories', 50, doc.y);
    doc.moveDown(0.5);
    
    const headers = ['Category', 'Total Amount', 'Count', 'Average', '% of Total'];
    const columnWidths = [120, 100, 60, 80, 80];
    
    this.addTableHeader(doc, headers, columnWidths);
    
    let currentY = doc.y;
    
    data.categories.forEach((category: any) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        this.addTableHeader(doc, headers, columnWidths);
        currentY = doc.y;
      }
      
      doc.fontSize(9).fillColor('#000000');
      doc.text(category.category, 50, currentY);
      doc.text(this.formatCurrency(category.totalAmount), 170, currentY);
      doc.text(category.expenseCount.toString(), 270, currentY);
      doc.text(this.formatCurrency(category.averageAmount), 330, currentY);
      doc.text(`${category.percentage.toFixed(2)}%`, 410, currentY);
      
      currentY += 20;
      doc.y = currentY;
    });
    
    // Add pie chart placeholder
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666666');
    doc.text('Category Distribution Chart:', 50, doc.y);
    
    // In production, you would generate and embed an actual chart image
    // For now, create a simple text representation
    doc.moveDown(0.5);
    data.categories.forEach((category: any) => {
      const barWidth = (category.percentage / 100) * 300;
      doc.rect(50, doc.y, barWidth, 10).fill(category.category === 'food' ? '#FF6B6B' : 
                                              category.category === 'transportation' ? '#4ECDC4' : 
                                              category.category === 'entertainment' ? '#FFD166' : '#118AB2');
      doc.fontSize(8).fillColor('#000000');
      doc.text(`${category.category}: ${category.percentage.toFixed(1)}%`, 50, doc.y + 12);
      doc.moveDown(1.5);
    });
  }

  /**
   * Add partner summary content
   */
  private addPartnerSummary(doc: PDFKit.PDFDocument, data: any): void {
    doc.fontSize(12).fillColor('#333333');
    doc.text('Partner Summary', 50, doc.y);
    doc.moveDown(0.5);
    
    const headers = ['Partner', 'Owed to You', 'You Owe', 'Net Balance', 'Expenses'];
    const columnWidths = [150, 90, 90, 90, 60];
    
    this.addTableHeader(doc, headers, columnWidths);
    
    let currentY = doc.y;
    
    data.partners.forEach((partner: any) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        this.addTableHeader(doc, headers, columnWidths);
        currentY = doc.y;
      }
      
      const netBalanceColor = partner.netBalance > 0 ? '#00AA00' : partner.netBalance < 0 ? '#FF0000' : '#000000';
      
      doc.fontSize(9).fillColor('#000000');
      doc.text(partner.partnerName, 50, currentY);
      doc.text(this.formatCurrency(partner.totalOwedToYou), 200, currentY);
      doc.text(this.formatCurrency(partner.totalYouOwe), 290, currentY);
      doc.fillColor(netBalanceColor);
      doc.text(this.formatCurrency(partner.netBalance), 380, currentY);
      doc.fillColor('#000000');
      doc.text(partner.expenseCount.toString(), 470, currentY);
      
      currentY += 20;
      doc.y = currentY;
    });
    
    // Summary
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#333333');
    doc.text('Overall Position:', 50, doc.y);
    doc.text(`Total Owed to You: ${this.formatCurrency(data.summary.totalOwedToYou)}`, 200, doc.y);
    doc.text(`Total You Owe: ${this.formatCurrency(data.summary.totalYouOwe)}`, 350, doc.y);
    
    doc.moveDown(1);
    const netPositionColor = data.summary.netPosition > 0 ? '#00AA00' : data.summary.netPosition < 0 ? '#FF0000' : '#000000';
    doc.fillColor(netPositionColor);
    doc.text(`Net Position: ${this.formatCurrency(data.summary.netPosition)}`, 50, doc.y);
  }

  /**
   * Add payment history content
   */
  private addPaymentHistory(doc: PDFKit.PDFDocument, data: any): void {
    doc.fontSize(12).fillColor('#333333');
    doc.text('Payment History', 50, doc.y);
    doc.moveDown(0.5);
    
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Status'];
    const columnWidths = [80, 80, 150, 80, 60];
    
    this.addTableHeader(doc, headers, columnWidths);
    
    let currentY = doc.y;
    
    data.timeline.forEach((item: any) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        this.addTableHeader(doc, headers, columnWidths);
        currentY = doc.y;
      }
      
      const typeColor = item.type === 'EXPENSE' ? '#FF6B6B' : '#4ECDC4';
      
      doc.fontSize(9).fillColor('#000000');
      doc.text(new Date(item.date).toLocaleDateString(), 50, currentY);
      doc.fillColor(typeColor);
      doc.text(item.type, 130, currentY);
      doc.fillColor('#000000');
      doc.text(item.description.substring(0, 30) + '...', 210, currentY);
      doc.text(this.formatCurrency(item.amount), 360, currentY);
      doc.text(item.direction || 'N/A', 440, currentY);
      
      currentY += 20;
      doc.y = currentY;
    });
  }

  /**
   * Add transaction list content
   */
  private addTransactionList(doc: PDFKit.PDFDocument, data: any): void {
    doc.fontSize(12).fillColor('#333333');
    doc.text('Transaction Details', 50, doc.y);
    doc.moveDown(0.5);
    
    // Expenses
    if (data.expenses.length > 0) {
      doc.fontSize(11).fillColor('#333333');
      doc.text('Expenses', 50, doc.y);
      doc.moveDown(0.5);
      
      data.expenses.forEach((expense: any) => {
        this.addTransactionItem(doc, expense, 'EXPENSE');
        doc.moveDown(0.5);
      });
    }
    
    // Settlements
    if (data.settlements.length > 0) {
      doc.fontSize(11).fillColor('#333333');
      doc.text('Settlements', 50, doc.y);
      doc.moveDown(0.5);
      
      data.settlements.forEach((settlement: any) => {
        this.addTransactionItem(doc, settlement, 'SETTLEMENT');
        doc.moveDown(0.5);
      });
    }
  }

  /**
   * Add individual transaction item
   */
  private addTransactionItem(doc: PDFKit.PDFDocument, item: any, type: string): void {
    doc.fontSize(9).fillColor('#000000');
    
    // Date and Type
    doc.text(`${new Date(item.createdAt || item.date).toLocaleDateString()} - ${type}`, 50, doc.y);
    
    // Description
    doc.text(`Description: ${item.description}`, 50, doc.y + 15);
    
    // Amount and Currency
    doc.text(`Amount: ${this.formatCurrency(item.amount)} ${item.currency}`, 50, doc.y + 30);
    
    // Additional details based on type
    if (type === 'EXPENSE') {
      doc.text(`Category: ${item.category}`, 200, doc.y + 15);
      doc.text(`Paid by: ${item.paidByUser?.name || item.paidBy}`, 200, doc.y + 30);
      doc.text(`Participants: ${item.participants?.length || 0}`, 200, doc.y + 45);
      doc.text(`Settled: ${item.isSettled ? 'Yes' : 'No'}`, 350, doc.y + 15);
    } else if (type === 'SETTLEMENT') {
      doc.text(`Direction: ${item.direction}`, 200, doc.y + 15);
      doc.text(`Counterparty: ${item.counterpartyName}`, 200, doc.y + 30);
      doc.text(`Transaction: ${item.transactionHash?.substring(0, 20)}...`, 200, doc.y + 45);
    }
    
    doc.y += 60;
  }

  /**
   * Add table header
   */
  private addTableHeader(doc: PDFKit.PDFDocument, headers: string[], columnWidths: number[]): void {
    const startX = 50;
    const startY = doc.y;
    
    doc.fontSize(10).fillColor('#FFFFFF');
    
    // Draw header background
    doc.rect(startX, startY, columnWidths.reduce((a, b) => a + b, 0), 25).fill('#333333');
    
    // Draw header text
    let currentX = startX;
    headers.forEach((header, index) => {
      doc.text(header, currentX + 5, startY + 8);
      currentX += columnWidths[index];
    });
    
    doc.y = startY + 30;
  }

  /**
   * Add footer
   */
  private addFooter(doc: PDFKit.PDFDocument, job: ExportJob): void {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Footer text
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        `Generated by StellarSplit on ${new Date().toLocaleDateString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' },
      );
      
      // Confidential notice
      doc.text(
        'CONFIDENTIAL - For authorized use only',
        50,
        doc.page.height - 30,
        { align: 'center' },
      );
    }
  }

  /**
   * Add page numbers
   */
  private addPageNumbers(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#666666');
      doc.text(
        `Page ${i + 1} of ${pages.count}`,
        doc.page.width - 100,
        doc.page.height - 30,
      );
    }
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}