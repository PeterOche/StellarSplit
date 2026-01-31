import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ExportFormat, ReportType } from './entities/export-job.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    const smtpConfig = {
      host: this.configService.get('SMTP_HOST'),
      port: parseInt(this.configService.get('SMTP_PORT') || '587'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  /**
   * Send export email
   */
  async sendExportEmail(
    to: string,
    fileName: string,
    fileUrl: string,
    format: ExportFormat,
    reportType: ReportType,
  ): Promise<void> {
    const formatNames = {
      [ExportFormat.CSV]: 'CSV',
      [ExportFormat.PDF]: 'PDF',
      [ExportFormat.JSON]: 'JSON',
      [ExportFormat.QBO]: 'QuickBooks',
      [ExportFormat.OFX]: 'OFX',
      [ExportFormat.XLSX]: 'Excel',
    };

    const reportNames = {
      [ReportType.MONTHLY_SUMMARY]: 'Monthly Summary',
      [ReportType.ANNUAL_TAX_REPORT]: 'Annual Tax Report',
      [ReportType.CATEGORY_BREAKDOWN]: 'Category Breakdown',
      [ReportType.PARTNER_WISE_SUMMARY]: 'Partner-wise Summary',
      [ReportType.PAYMENT_HISTORY]: 'Payment History',
      [ReportType.CUSTOM]: 'Custom Report',
    };

    const subject = `Your ${reportNames[reportType]} Export from StellarSplit`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Ready</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #4F46E5;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
        }
        .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 5px 5px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4F46E5;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
        }
        .details {
            background-color: white;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #4F46E5;
        }
        .details dt {
            font-weight: bold;
            margin-top: 10px;
        }
        .details dd {
            margin-left: 0;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Your Export is Ready!</h1>
    </div>
    
    <div class="content">
        <p>Hello,</p>
        
        <p>Your expense report export has been generated and is ready for download.</p>
        
        <div class="details">
            <dl>
                <dt>Report Type:</dt>
                <dd>${reportNames[reportType]}</dd>
                
                <dt>File Format:</dt>
                <dd>${formatNames[format]}</dd>
                
                <dt>File Name:</dt>
                <dd>${fileName}</dd>
                
                <dt>Generated At:</dt>
                <dd>${new Date().toLocaleString()}</dd>
            </dl>
        </div>
        
        <p>
            <a href="${fileUrl}" class="button">Download Export</a>
        </p>
        
        <p><strong>Important:</strong> This download link will expire in 7 days. Please download the file promptly.</p>
        
        <p>If you did not request this export or have any questions, please contact our support team.</p>
        
        <div class="footer">
            <p>Best regards,<br>The StellarSplit Team</p>
            <p>
                <small>
                    This email was sent automatically. Please do not reply to this message.<br>
                    Need help? Contact <a href="mailto:support@stellarsplit.com">support@stellarsplit.com</a>
                </small>
            </p>
        </div>
    </div>
</body>
</html>
    `;

    const text = `
Your Export is Ready!

Hello,

Your expense report export has been generated and is ready for download.

Report Type: ${reportNames[reportType]}
File Format: ${formatNames[format]}
File Name: ${fileName}
Generated At: ${new Date().toLocaleString()}

Download your export here: ${fileUrl}

Important: This download link will expire in 7 days. Please download the file promptly.

If you did not request this export or have any questions, please contact our support team.

Best regards,
The StellarSplit Team

Need help? Contact support@stellarsplit.com
    `;

    const mailOptions = {
      from: this.configService.get('EMAIL_FROM') || 'exports@stellarsplit.com',
      to,
      subject,
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Export email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send export email:`, error);
      throw error;
    }
  }

  /**
   * Send scheduled report email
   */
  async sendScheduledReportEmail(
    recipients: string[],
    fileName: string,
    fileUrl: string,
    templateName: string,
  ): Promise<void> {
    for (const recipient of recipients) {
      await this.sendExportEmail(
        recipient,
        fileName,
        fileUrl,
        ExportFormat.PDF,
        ReportType.MONTHLY_SUMMARY,
      );
    }
  }
}