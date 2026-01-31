import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ExportJob, ExportFormat, ReportType, ExportStatus } from './entities/export-job.entity';
import { ExportTemplate } from './entities/export-template.entity';
import { CreateExportDto, ExportFilterDto } from './dto/export-request.dto';
import { CsvGeneratorService } from './csv-generator.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { QuickBooksGeneratorService } from './quickbooks-generator.service';
import { OfxGeneratorService } from './ofx-generator.service';
import { EmailService } from './email.service';
import { StorageService } from './storage.service';
// import { ExpensesService } from '../expenses/expenses.service';
// import { SplitsService } from '../splits/splits.service';
// import { UsersService } from '../users/users.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(ExportJob)
    private readonly exportJobRepository: Repository<ExportJob>,
    @InjectRepository(ExportTemplate)
    private readonly exportTemplateRepository: Repository<ExportTemplate>,
    private readonly configService: ConfigService,
    private readonly csvGeneratorService: CsvGeneratorService,
    private readonly pdfGeneratorService: PdfGeneratorService,
    private readonly quickBooksGeneratorService: QuickBooksGeneratorService,
    private readonly ofxGeneratorService: OfxGeneratorService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Create a new export job
   */
  async createExport(userId: string, dto: CreateExportDto): Promise<ExportJob> {
    // Validate date range
    if (dto.filters?.startDate && dto.filters?.endDate) {
      const start = new Date(dto.filters.startDate);
      const end = new Date(dto.filters.endDate);
      if (start > end) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    // Create export job
    const exportJob = this.exportJobRepository.create({
      userId,
      format: dto.format,
      reportType: dto.reportType,
      filters: dto.filters || {},
      status: ExportStatus.PENDING,
      expiresAt: this.getExpiryDate(),
      emailRecipient: dto.emailRecipient,
      isTaxCompliant: dto.isTaxCompliant || false,
      taxYear: dto.taxYear,
      metadata: {
        settings: dto.settings || {},
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    const savedJob = await this.exportJobRepository.save(exportJob);

    // Process export asynchronously
    this.processExport(savedJob.id).catch((error) => {
      this.logger.error(`Failed to process export ${savedJob.id}:`, error);
    });

    return savedJob;
  }

  /**
   * Process an export job
   */
  private async processExport(jobId: string): Promise<void> {
    const job = await this.exportJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    try {
      // Update status to processing
      await this.updateJobStatus(jobId, ExportStatus.PROCESSING);

      // Fetch data based on filters
      const data = await this.fetchExportData(job.userId, job.filters, job.reportType);

      // Generate file based on format
      let fileBuffer: Buffer;
      let fileName: string;
      let fileExtension: string;

      switch (job.format) {
        case ExportFormat.CSV:
          fileBuffer = await this.csvGeneratorService.generateCsv(data, job);
          fileExtension = 'csv';
          fileName = this.generateFileName(job, 'csv');
          break;

        case ExportFormat.PDF:
          fileBuffer = await this.pdfGeneratorService.generatePdf(data, job);
          fileExtension = 'pdf';
          fileName = this.generateFileName(job, 'pdf');
          break;

        case ExportFormat.JSON:
          fileBuffer = Buffer.from(JSON.stringify(data, null, 2));
          fileExtension = 'json';
          fileName = this.generateFileName(job, 'json');
          break;

        case ExportFormat.QBO:
          fileBuffer = await this.quickBooksGeneratorService.generateQbo(data, job);
          fileExtension = 'qbo';
          fileName = this.generateFileName(job, 'qbo');
          break;

        case ExportFormat.OFX:
          fileBuffer = await this.ofxGeneratorService.generateOfx(data, job);
          fileExtension = 'ofx';
          fileName = this.generateFileName(job, 'ofx');
          break;

        case ExportFormat.XLSX:
          fileBuffer = await this.csvGeneratorService.generateXlsx(data, job);
          fileExtension = 'xlsx';
          fileName = this.generateFileName(job, 'xlsx');
          break;

        default:
          throw new BadRequestException(`Unsupported export format: ${job.format}`);
      }

      // Upload to storage
      const uploadResult = await this.storageService.uploadFile(
        fileBuffer,
        fileName,
        job.userId,
      );

      // Calculate summary
      const summary = this.calculateSummary(data);

      // Update job with results
      await this.exportJobRepository.update(jobId, {
        status: ExportStatus.COMPLETED,
        fileName,
        fileUrl: uploadResult.url,
        s3Key: uploadResult.key,
        fileSize: fileBuffer.length,
        recordCount: data.expenses.length + data.settlements.length,
        summary,
        completedAt: new Date(),
      });

      // Send email if requested
      if (job.emailRecipient) {
        await this.sendExportEmail(jobId);
      }

      this.logger.log(`Export ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process export ${jobId}:`, error);
      
      await this.exportJobRepository.update(jobId, {
        status: ExportStatus.FAILED,
        // errorMessage: error.message,
      });
    }
  }

  /**
   * Fetch data for export based on filters
   */
  private async fetchExportData(
    userId: string,
    filters: ExportFilterDto,
    reportType: ReportType,
  ): Promise<any> {
    const queryBuilder = {
      where: { userId },
      relations: ['participants', 'payments', 'receipt'],
    };

    // Apply date filters
    if (filters.startDate || filters.endDate) {
      const where: any = { userId };
      
      if (filters.startDate) {
        where.createdAt = MoreThanOrEqual(new Date(filters.startDate));
      }
      if (filters.endDate) {
        where.createdAt = LessThanOrEqual(new Date(filters.endDate));
      }
      
      queryBuilder.where = where;
    }

    // Apply category filter
    if (filters.categories?.length) {
      queryBuilder.where = {
        ...queryBuilder.where
      };
    }

    // Apply currency filter
    if (filters.currency) {
      queryBuilder.where = {
        ...queryBuilder.where
      };
    }

    // Apply settlement status filter
    if (filters.settled !== undefined) {
      queryBuilder.where = {
        ...queryBuilder.where,
      };
    }

    // Fetch expenses
    const expenses = {}

    // Filter by participants if specified
    let filteredExpenses = expenses;
    if (filters.participants?.length) {
      filteredExpenses = expenses.filter((expense) =>
        expense.participants.some((p) => filters.participants.includes(p.userId)),
      );
    }

    // Filter by paidByMe/owedToMe
    if (filters.paidByMe) {
      filteredExpenses = filteredExpenses.filter((expense) => expense.paidBy === userId);
    }

    if (filters.owedToMe) {
      filteredExpenses = filteredExpenses.filter((expense) =>
        expense.participants.some((p) => p.userId === userId && p.amount > 0),
      );
    }

    // Fetch settlements for the same period
    const settlements = await this.splitsService.findSettlements({
      userId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    // Format data based on report type
    switch (reportType) {
      case ReportType.MONTHLY_SUMMARY:
        return this.formatMonthlySummary(filteredExpenses, settlements);
      case ReportType.ANNUAL_TAX_REPORT:
        return this.formatAnnualTaxReport(filteredExpenses, settlements);
      case ReportType.CATEGORY_BREAKDOWN:
        return this.formatCategoryBreakdown(filteredExpenses, settlements);
      case ReportType.PARTNER_WISE_SUMMARY:
        return this.formatPartnerWiseSummary(userId, filteredExpenses, settlements);
      case ReportType.PAYMENT_HISTORY:
        return this.formatPaymentHistory(filteredExpenses, settlements);
      default:
        return {
          expenses: filteredExpenses,
          settlements,
          metadata: {
            totalExpenses: filteredExpenses.length,
            totalSettlements: settlements.length,
            generatedAt: new Date().toISOString(),
          },
        };
    }
  }

  /**
   * Format data for monthly summary report
   */
  private formatMonthlySummary(expenses: any[], settlements: any[]) {
    const monthlyData = {};
    
    expenses.forEach((expense) => {
      const month = expense.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          totalExpenses: 0,
          totalAmount: 0,
          expenseCount: 0,
          categories: {},
          settlements: 0,
          settlementAmount: 0,
        };
      }
      
      monthlyData[month].totalExpenses += expense.amount;
      monthlyData[month].expenseCount++;
      
      // Track by category
      if (!monthlyData[month].categories[expense.category]) {
        monthlyData[month].categories[expense.category] = 0;
      }
      monthlyData[month].categories[expense.category] += expense.amount;
    });

    settlements.forEach((settlement) => {
      const month = settlement.createdAt.toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          totalExpenses: 0,
          totalAmount: 0,
          expenseCount: 0,
          categories: {},
          settlements: 0,
          settlementAmount: 0,
        };
      }
      
      monthlyData[month].settlements++;
      monthlyData[month].settlementAmount += settlement.amount;
    });

    return {
      monthlyData: Object.values(monthlyData),
      summary: this.calculateSummary({ expenses, settlements }),
      metadata: {
        reportType: 'MONTHLY_SUMMARY',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Format data for annual tax report
   */
  private formatAnnualTaxReport(expenses: any[], settlements: any[]) {
    const taxData = {
      businessExpenses: expenses.filter((e) => this.isBusinessExpense(e)),
      personalExpenses: expenses.filter((e) => !this.isBusinessExpense(e)),
      incomeFromSettlements: settlements.filter((s) => s.direction === 'incoming'),
      paymentsMade: settlements.filter((s) => s.direction === 'outgoing'),
      deductibleAmount: this.calculateDeductibleAmount(expenses),
      taxableIncome: this.calculateTaxableIncome(settlements),
    };

    return {
      ...taxData,
      summary: {
        totalBusinessExpenses: taxData.businessExpenses.reduce((sum, e) => sum + e.amount, 0),
        totalPersonalExpenses: taxData.personalExpenses.reduce((sum, e) => sum + e.amount, 0),
        totalIncome: taxData.incomeFromSettlements.reduce((sum, s) => sum + s.amount, 0),
        totalPayments: taxData.paymentsMade.reduce((sum, s) => sum + s.amount, 0),
        deductibleAmount: taxData.deductibleAmount,
        taxableIncome: taxData.taxableIncome,
      },
      metadata: {
        reportType: 'ANNUAL_TAX_REPORT',
        generatedAt: new Date().toISOString(),
        taxDisclaimer: 'Consult with a tax professional for accurate tax filing',
      },
    };
  }

  /**
   * Calculate deductible amount for tax purposes
   */
  private calculateDeductibleAmount(expenses: any[]): number {
    const deductibleCategories = [
      'business',
      'office',
      'travel',
      'equipment',
      'education',
      'professional',
    ];
    
    return expenses
      .filter((expense) => deductibleCategories.includes(expense.category))
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  /**
   * Calculate taxable income from settlements
   */
  private calculateTaxableIncome(settlements: any[]): number {
    return settlements
      .filter((settlement) => settlement.direction === 'incoming')
      .reduce((sum, settlement) => sum + settlement.amount, 0);
  }

  /**
   * Check if expense is business-related
   */
  private isBusinessExpense(expense: any): boolean {
    const businessCategories = [
      'business',
      'office',
      'travel',
      'equipment',
      'education',
      'professional',
    ];
    return businessCategories.includes(expense.category);
  }

  /**
   * Format data for category breakdown
   */
  private formatCategoryBreakdown(expenses: any[], settlements: any[]) {
    const categoryData = {};
    
    expenses.forEach((expense) => {
      if (!categoryData[expense.category]) {
        categoryData[expense.category] = {
          category: expense.category,
          totalAmount: 0,
          expenseCount: 0,
          averageAmount: 0,
          percentage: 0,
        };
      }
      
      categoryData[expense.category].totalAmount += expense.amount;
      categoryData[expense.category].expenseCount++;
    });

    const totalAmount = Object.values(categoryData).reduce(
      (sum: number, cat: any) => sum + cat.totalAmount,
      0,
    );

    // Calculate percentages and averages
    Object.values(categoryData).forEach((cat: any) => {
      cat.averageAmount = cat.totalAmount / cat.expenseCount;
      cat.percentage = totalAmount > 0 ? (cat.totalAmount / totalAmount) * 100 : 0;
    });

    return {
      categories: Object.values(categoryData),
      summary: {
        totalAmount,
        totalExpenses: expenses.length,
        categoryCount: Object.keys(categoryData).length,
      },
      metadata: {
        reportType: 'CATEGORY_BREAKDOWN',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Format data for partner-wise summary
   */
  private async formatPartnerWiseSummary(userId: string, expenses: any[], settlements: any[]) {
    const partnerData = {};
    
    // Process expenses to calculate balances with each partner
    expenses.forEach((expense) => {
      expense.participants.forEach((participant) => {
        if (participant.userId === userId) return; // Skip self
        
        const partnerId = participant.userId;
        if (!partnerData[partnerId]) {
          partnerData[partnerId] = {
            partnerId,
            partnerName: participant.user?.name || 'Unknown',
            totalOwedToYou: 0,
            totalYouOwe: 0,
            netBalance: 0,
            expenseCount: 0,
            lastInteraction: expense.createdAt,
          };
        }
        
        if (expense.paidBy === userId) {
          // User paid, partner owes user
          partnerData[partnerId].totalOwedToYou += participant.amount;
        } else if (expense.paidBy === partnerId) {
          // Partner paid, user owes partner
          partnerData[partnerId].totalYouOwe += participant.amount;
        }
        
        partnerData[partnerId].expenseCount++;
        partnerData[partnerId].lastInteraction = new Date(
          Math.max(
            new Date(partnerData[partnerId].lastInteraction).getTime(),
            new Date(expense.createdAt).getTime(),
          ),
        );
      });
    });

    // Process settlements
    settlements.forEach((settlement) => {
      const partnerId = settlement.counterpartyId;
      if (!partnerData[partnerId]) {
        partnerData[partnerId] = {
          partnerId,
          partnerName: 'Unknown',
          totalOwedToYou: 0,
          totalYouOwe: 0,
          netBalance: 0,
          expenseCount: 0,
          lastInteraction: settlement.createdAt,
        };
      }
      
      if (settlement.direction === 'incoming') {
        partnerData[partnerId].totalOwedToYou -= settlement.amount;
      } else {
        partnerData[partnerId].totalYouOwe -= settlement.amount;
      }
    });

    // Calculate net balances and fetch partner names
    for (const partnerId in partnerData) {
      const partner = partnerData[partnerId];
      partner.netBalance = partner.totalOwedToYou - partner.totalYouOwe;
      
      // Fetch partner name if not already available
      if (!partner.partnerName || partner.partnerName === 'Unknown') {
        try {
          const user = await this.usersService.findOne(partnerId);
          partner.partnerName = user?.name || 'Unknown';
        } catch (error) {
          this.logger.warn(`Could not fetch user ${partnerId}:`, error);
        }
      }
    }

    return {
      partners: Object.values(partnerData),
      summary: {
        totalOwedToYou: Object.values(partnerData).reduce(
          (sum: number, p: any) => sum + p.totalOwedToYou,
          0,
        ),
        totalYouOwe: Object.values(partnerData).reduce(
          (sum: number, p: any) => sum + p.totalYouOwe,
          0,
        ),
        netPosition: Object.values(partnerData).reduce(
          (sum: number, p: any) => sum + p.netBalance,
          0,
        ),
        partnerCount: Object.keys(partnerData).length,
      },
      metadata: {
        reportType: 'PARTNER_WISE_SUMMARY',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Format data for payment history
   */
  private formatPaymentHistory(expenses: any[], settlements: any[]) {
    // Combine expenses and settlements into chronological timeline
    const timeline = [
      ...expenses.map((expense) => ({
        type: 'EXPENSE',
        date: expense.createdAt,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        category: expense.category,
        participants: expense.participants.length,
        id: expense.id,
      })),
      ...settlements.map((settlement) => ({
        type: 'SETTLEMENT',
        date: settlement.createdAt,
        amount: settlement.amount,
        currency: settlement.currency,
        description: settlement.description || 'Payment settlement',
        direction: settlement.direction,
        counterparty: settlement.counterpartyName,
        id: settlement.id,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      timeline,
      summary: {
        totalExpenses: expenses.length,
        totalSettlements: settlements.length,
        totalAmount: timeline.reduce((sum, item) => sum + item.amount, 0),
        periodCovered: timeline.length > 0 
          ? `${new Date(timeline[timeline.length - 1].date).toISOString().split('T')[0]} to ${new Date(timeline[0].date).toISOString().split('T')[0]}`
          : 'No data',
      },
      metadata: {
        reportType: 'PAYMENT_HISTORY',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(data: any) {
    const expenses = data.expenses || [];
    const settlements = data.settlements || [];
    
    const currencyBreakdown = {};
    const categoryBreakdown = {};
    
    let totalAmount = 0;
    
    // Calculate expense totals
    expenses.forEach((expense) => {
      totalAmount += expense.amount;
      
      // Currency breakdown
      if (!currencyBreakdown[expense.currency]) {
        currencyBreakdown[expense.currency] = 0;
      }
      currencyBreakdown[expense.currency] += expense.amount;
      
      // Category breakdown
      if (!categoryBreakdown[expense.category]) {
        categoryBreakdown[expense.category] = 0;
      }
      categoryBreakdown[expense.category] += expense.amount;
    });
    
    // Calculate settlement totals
    const totalSettlements = settlements.reduce((sum, s) => sum + s.amount, 0);
    
    return {
      totalAmount,
      totalExpenses: expenses.length,
      totalSettlements: settlements.length,
      settlementAmount: totalSettlements,
      currencyBreakdown,
      categoryBreakdown,
    };
  }

  /**
   * Generate file name
   */
  private generateFileName(job: ExportJob, extension: string): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = Date.now();
    
    let prefix = 'export';
    switch (job.reportType) {
      case ReportType.MONTHLY_SUMMARY:
        prefix = 'monthly-summary';
        break;
      case ReportType.ANNUAL_TAX_REPORT:
        prefix = `tax-report-${job.taxYear || new Date().getFullYear()}`;
        break;
      case ReportType.CATEGORY_BREAKDOWN:
        prefix = 'category-breakdown';
        break;
      case ReportType.PARTNER_WISE_SUMMARY:
        prefix = 'partner-summary';
        break;
      case ReportType.PAYMENT_HISTORY:
        prefix = 'payment-history';
        break;
    }
    
    return `${prefix}-${date}-${timestamp}.${extension}`;
  }

  /**
   * Get expiry date for export files (7 days from now)
   */
  private getExpiryDate(): Date {
    const expiryDays = parseInt(this.configService.get('EXPORT_EXPIRY_DAYS') || '7');
    const date = new Date();
    date.setDate(date.getDate() + expiryDays);
    return date;
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: ExportStatus): Promise<void> {
    await this.exportJobRepository.update(jobId, { status });
  }

  /**
   * Send export email
   */
  private async sendExportEmail(jobId: string): Promise<void> {
    const job = await this.exportJobRepository.findOne({ where: { id: jobId } });
    
    if (!job || !job.emailRecipient || job.emailSent) {
      return;
    }
    
    try {
      await this.emailService.sendExportEmail(
        job.emailRecipient,
        job.fileName,
        job.fileUrl,
        job.format,
        job.reportType,
      );
      
      await this.exportJobRepository.update(jobId, {
        emailSent: true,
        emailSentAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to send email for export ${jobId}:`, error);
    }
  }

  /**
   * Get export job status
   */
  async getExportStatus(jobId: string, userId: string): Promise<ExportJob> {
    const job = await this.exportJobRepository.findOne({
      where: { id: jobId, userId },
    });
    
    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }
    
    return job;
  }

  /**
   * List user's export jobs
   */
  async listExports(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ jobs: ExportJob[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    
    const [jobs, total] = await this.exportJobRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    
    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Download export file
   */
  async downloadExport(jobId: string, userId: string): Promise<{ url: string; fileName: string }> {
    const job = await this.exportJobRepository.findOne({
      where: { id: jobId, userId, status: ExportStatus.COMPLETED },
    });
    
    if (!job) {
      throw new NotFoundException('Export not found or not ready');
    }
    
    // Check if file has expired
    if (new Date() > job.expiresAt) {
      throw new BadRequestException('Export file has expired');
    }
    
    // Generate temporary download URL
    const downloadUrl = await this.storageService.getSignedUrl(job.s3Key);
    
    return {
      url: downloadUrl,
      fileName: job.fileName,
    };
  }

  /**
   * Create export template
   */
  async createTemplate(userId: string, dto: CreateExportTemplateDto): Promise<ExportTemplate> {
    // If setting as default, unset any existing default
    if (dto.isDefault) {
      await this.exportTemplateRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }
    
    const template = this.exportTemplateRepository.create({
      userId,
      ...dto,
    });
    
    return await this.exportTemplateRepository.save(template);
  }

  /**
   * List user's export templates
   */
  async listTemplates(userId: string): Promise<ExportTemplate[]> {
    return await this.exportTemplateRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Delete export template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const result = await this.exportTemplateRepository.delete({
      id: templateId,
      userId,
    });
    
    if (result.affected === 0) {
      throw new NotFoundException('Template not found');
    }
  }

  /**
   * Schedule recurring export
   */
  async scheduleExport(userId: string, dto: ScheduleExportDto): Promise<ExportTemplate> {
    // Create template for scheduled export
    const template = await this.createTemplate(userId, {
      name: dto.name || `Scheduled ${dto.reportType} Export`,
      description: `Automated export scheduled with cron: ${dto.scheduleCron}`,
      format: dto.format,
      reportType: dto.reportType,
      filters: dto.filters,
      settings: dto.settings,
      isDefault: false,
      isScheduled: true,
      scheduleCron: dto.scheduleCron,
      emailRecipients: dto.emailRecipient ? [dto.emailRecipient] : [],
    });
    
    // Schedule the job
    this.scheduleRecurringExport(template);
    
    return template;
  }

  /**
   * Schedule recurring export using template
   */
  private scheduleRecurringExport(template: ExportTemplate): void {
    // This would be implemented using a job scheduler like Bull or Agenda
    // For now, we'll just store the template with scheduling info
    this.logger.log(`Scheduled export template ${template.id} with cron: ${template.scheduleCron}`);
  }

  /**
   * Cron job to clean up expired exports
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredExports(): Promise<void> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 1); // Clean up exports expired yesterday
    
    const expiredJobs = await this.exportJobRepository.find({
      where: {
        expiresAt: LessThanOrEqual(expiryDate),
        status: ExportStatus.COMPLETED,
      },
    });
    
    for (const job of expiredJobs) {
      try {
        // Delete from storage
        if (job.s3Key) {
          await this.storageService.deleteFile(job.s3Key);
        }
        
        // Update status
        await this.exportJobRepository.update(job.id, {
          status: ExportStatus.EXPIRED,
          fileUrl: null,
          s3Key: null,
        });
        
        this.logger.log(`Cleaned up expired export: ${job.id}`);
      } catch (error) {
        this.logger.error(`Failed to clean up export ${job.id}:`, error);
      }
    }
  }

  /**
   * Cron job to process scheduled exports
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledExports(): Promise<void> {
    const templates = await this.exportTemplateRepository.find({
      where: { isScheduled: true },
    });
    
    const now = new Date();
    
    for (const template of templates) {
      // Check if it's time to run this scheduled export
      if (this.shouldRunScheduledExport(template, now)) {
        try {
          // Create export job from template
          await this.createExport(template.userId, {
            format: template.format,
            reportType: template.reportType,
            filters: template.filters,
            settings: template.settings,
            emailRecipient: template.emailRecipients?.[0],
            isTaxCompliant: template.settings?.includeTaxFields || false,
          });
          
          this.logger.log(`Processed scheduled export from template: ${template.id}`);
        } catch (error) {
          this.logger.error(`Failed to process scheduled export ${template.id}:`, error);
        }
      }
    }
  }

  /**
   * Check if scheduled export should run
   */
  private shouldRunScheduledExport(template: ExportTemplate, now: Date): boolean {
    // Simplified check - in production, use a proper cron parser
    // For now, check if it's the first day of the month for monthly reports
    if (template.reportType === ReportType.MONTHLY_SUMMARY) {
      return now.getDate() === 1 && now.getHours() === 9; // 9 AM on 1st of month
    }
    
    return false;
  }
}