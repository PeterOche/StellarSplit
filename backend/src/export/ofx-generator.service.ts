import { Injectable } from '@nestjs/common';
import { ExportJob } from './entities/export-job.entity';

@Injectable()
export class OfxGeneratorService {
  /**
   * Generate OFX (Open Financial Exchange) file
   */
  async generateOfx(data: any, job: ExportJob): Promise<Buffer> {
    const ofxContent = this.generateOfxContent(data, job);
    return Buffer.from(ofxContent, 'utf8');
  }

  /**
   * Generate OFX content
   */
  private generateOfxContent(data: any, job: ExportJob): string {
    const now = new Date();
    const dtStart = job.filters?.startDate ? new Date(job.filters.startDate) : new Date(now.getFullYear(), 0, 1);
    const dtEnd = job.filters?.endDate ? new Date(job.filters.endDate) : now;
    
    const ofxHeader = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRQV1>
    <SONRQ>
      <DTCLIENT>${this.formatOfxDate(now)}</DTCLIENT>
      <USERID>${job.userId}</USERID>
      <USERPASS>NOTREQUIRED</USERPASS>
      <LANGUAGE>ENG</LANGUAGE>
      <FI>
        <ORG>StellarSplit</ORG>
        <FID>001</FID>
      </FI>
      <APPID>QWIN</APPID>
      <APPVER>2500</APPVER>
    </SONRQ>
  </SIGNONMSGSRQV1>
  <BANKMSGSRQV1>
    <STMTTRNRQ>
      <TRNUID>${Date.now()}</TRNUID>
      <STMTRQ>
        <BANKACCTFROM>
          <BANKID>123456789</BANKID>
          <ACCTID>${job.userId}</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <INCTRAN>
          <DTSTART>${this.formatOfxDate(dtStart)}</DTSTART>
          <DTEND>${this.formatOfxDate(dtEnd)}</DTEND>
          <INCLUDE>Y</INCLUDE>
        </INCTRAN>
      </STMTRQ>
    </STMTTRNRQ>
  </BANKMSGSRQV1>
</OFX>`;

    const transactions = this.formatTransactionsForOfx(data);
    const ofxBody = `${ofxHeader}
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>${Date.now()}</TRNUID>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <STMTRS>
        <CURDEF>USD</CURDEF>
        <BANKACCTFROM>
          <BANKID>123456789</BANKID>
          <ACCTID>${job.userId}</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${this.formatOfxDate(dtStart)}</DTSTART>
          <DTEND>${this.formatOfxDate(dtEnd)}</DTEND>
          ${transactions}
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${this.calculateBalance(data)}</BALAMT>
          <DTASOF>${this.formatOfxDate(now)}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    return ofxBody;
  }

  /**
   * Format transactions for OFX
   */
  private formatTransactionsForOfx(data: any): string {
    let transactions = '';
    
    // Combine and sort all transactions by date
    const allTransactions = [
      ...data.expenses.map((expense: any) => ({
        type: 'EXPENSE',
        date: new Date(expense.createdAt),
        amount: -expense.amount, // Expenses are negative (money out)
        description: `Expense: ${expense.description}`,
        id: expense.id,
      })),
      ...data.settlements.map((settlement: any) => ({
        type: 'SETTLEMENT',
        date: new Date(settlement.createdAt),
        amount: settlement.direction === 'incoming' ? settlement.amount : -settlement.amount,
        description: `Settlement: ${settlement.description}`,
        id: settlement.id,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    allTransactions.forEach((transaction) => {
      transactions += `          <STMTTRN>
            <TRNTYPE>${transaction.amount > 0 ? 'CREDIT' : 'DEBIT'}</TRNTYPE>
            <DTPOSTED>${this.formatOfxDate(transaction.date)}</DTPOSTED>
            <TRNAMT>${Math.abs(transaction.amount).toFixed(2)}</TRNAMT>
            <FITID>${transaction.id}</FITID>
            <NAME>${this.escapeXml(transaction.description.substring(0, 32))}</NAME>
            <MEMO>${this.escapeXml(transaction.description)}</MEMO>
          </STMTTRN>\n`;
    });
    
    return transactions;
  }

  /**
   * Format date for OFX (YYYYMMDDHHMMSS)
   */
  private formatOfxDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Calculate balance for OFX
   */
  private calculateBalance(data: any): string {
    let balance = 0;
    
    data.expenses.forEach((expense: any) => {
      // Check if user paid for this expense
      if (expense.paidBy === data.userId) {
        // User paid, so money went out
        balance -= expense.amount;
        
        // But user should get reimbursed by others
        expense.participants.forEach((participant: any) => {
          if (participant.userId !== data.userId && participant.amount > 0) {
            balance += participant.amount;
          }
        });
      } else {
        // Someone else paid, user owes money
        const userShare = expense.participants.find((p: any) => p.userId === data.userId);
        if (userShare && userShare.amount > 0) {
          balance -= userShare.amount;
        }
      }
    });
    
    // Adjust for settlements
    data.settlements.forEach((settlement: any) => {
      if (settlement.direction === 'incoming') {
        balance += settlement.amount;
      } else {
        balance -= settlement.amount;
      }
    });
    
    return balance.toFixed(2);
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}