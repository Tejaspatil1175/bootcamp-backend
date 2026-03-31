import nodemailer from 'nodemailer';
import twilio from 'twilio';

/**
 * Notification Service - Handles SMS, Email, and In-App notifications
 */
class NotificationService {
  constructor() {
    // Twilio Configuration
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    /*
    // Initialize Twilio client if credentials are available
    if (this.twilioAccountSid && this.twilioAuthToken) {
      if (typeof this.twilioAccountSid === 'string' && this.twilioAccountSid.startsWith('AC')) {
        try {
          this.twilioClient = twilio(this.twilioAccountSid, this.twilioAuthToken);
          console.log('✅ Twilio SMS service initialized');
        } catch (error) {
          console.error('❌ Twilio initialization failed:', error.message);
          console.warn('⚠️ SMS service will be simulated');
        }
      } else {
        console.warn('⚠️ Twilio Account SID is invalid (must start with AC) - SMS will be simulated');
      }
    } else {
      console.warn('⚠️ Twilio credentials not configured - SMS will be simulated');
    }
    */
    console.log('📱 SMS service is in SIMULATION mode (Twilio disabled)');
    
    // Email Configuration (Nodemailer)
    this.emailConfig = {
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    };
    
    // Initialize email transporter
    if (this.emailConfig.auth.user && this.emailConfig.auth.pass) {
      this.emailTransporter = nodemailer.createTransport(this.emailConfig);
      console.log('✅ Email service initialized');
    } else {
      console.warn('⚠️ Email credentials not configured - Emails will be simulated');
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(phoneNumber, message) {
    try {
      // Ensure phone number has country code
      const formattedPhone = phoneNumber.startsWith('+') 
        ? phoneNumber 
        : `+91${phoneNumber}`; // Default to India

      // Twilio is commented out to force simulation
      /*
      if (this.twilioClient && this.twilioPhoneNumber) {
        const result = await this.twilioClient.messages.create({
          body: message,
          from: this.twilioPhoneNumber,
          to: formattedPhone
        });

        console.log(`📱 SMS sent to ${formattedPhone}: ${result.sid}`);
        
        return {
          success: true,
          messageId: result.sid,
          status: 'sent',
          provider: 'Twilio'
        };
      } else {
      */
        // Simulate SMS for development
        console.log(`📱 [SIMULATED SMS] To: ${formattedPhone}`);
        console.log(`   Message: ${message}`);
        
        return {
          success: true,
          messageId: `sim_${Date.now()}`,
          status: 'sent',
          provider: 'Simulated',
          simulated: true
        };
      // }
    } catch (error) {
      console.error('❌ SMS sending error:', error.message);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Send Email notification
   */
  async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      if (this.emailTransporter) {
        const mailOptions = {
          from: `"Fraud Protection System" <${this.emailConfig.auth.user}>`,
          to,
          subject,
          html: htmlContent,
          text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
        };

        const result = await this.emailTransporter.sendMail(mailOptions);
        
        console.log(`📧 Email sent to ${to}: ${result.messageId}`);
        
        return {
          success: true,
          messageId: result.messageId,
          status: 'sent',
          provider: 'Nodemailer'
        };
      } else {
        // Simulate email for development
        console.log(`📧 [SIMULATED EMAIL] To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Content: ${htmlContent.substring(0, 100)}...`);
        
        return {
          success: true,
          messageId: `sim_email_${Date.now()}`,
          status: 'sent',
          provider: 'Simulated',
          simulated: true
        };
      }
    } catch (error) {
      console.error('❌ Email sending error:', error.message);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Send transaction alert based on risk level
   */
  async sendTransactionAlert(user, transaction, riskLevel) {
    const notifications = [];
    const { notificationPreferences, email, phoneNumber } = user;

    // Prepare message content based on risk level
    let smsMessage, emailSubject, emailHtml;

    switch (riskLevel) {
      case 'VERY_LOW':
      case 'LOW':
        smsMessage = `Transaction of ₹${transaction.amount} to ${transaction.receiverUPI} completed successfully. TXN ID: ${transaction.transactionId}`;
        emailSubject = '✅ Transaction Successful';
        emailHtml = this.generateTransactionSuccessEmail(transaction);
        break;

      case 'MEDIUM':
        smsMessage = `⚠️ ALERT: Unusual transaction of ₹${transaction.amount} detected. Please verify. TXN ID: ${transaction.transactionId}`;
        emailSubject = '⚠️ Suspicious Transaction Detected';
        emailHtml = this.generateSuspiciousTransactionEmail(transaction);
        break;

      case 'HIGH':
        smsMessage = `🚨 HIGH RISK: Transaction of ₹${transaction.amount} flagged for review. Risk Score: ${transaction.fraudCheck.riskScore}/100. TXN ID: ${transaction.transactionId}`;
        emailSubject = '🚨 High Risk Transaction Alert';
        emailHtml = this.generateHighRiskTransactionEmail(transaction);
        break;

      case 'CRITICAL':
        smsMessage = `🛑 CRITICAL: Transaction BLOCKED! ₹${transaction.amount} to ${transaction.receiverUPI}. Your account has been FROZEN for security. Contact support immediately.`;
        emailSubject = '🛑 CRITICAL: Account Frozen - Fraudulent Activity Detected';
        emailHtml = this.generateAccountFrozenEmail(transaction, user);
        break;

      default:
        smsMessage = `Transaction update for TXN ID: ${transaction.transactionId}`;
        emailSubject = 'Transaction Update';
        emailHtml = this.generateGenericTransactionEmail(transaction);
    }

    // Send SMS if enabled
    if (phoneNumber && notificationPreferences?.sms?.transactionAlerts) {
      const smsResult = await this.sendSMS(phoneNumber, smsMessage);
      notifications.push({
        type: 'SMS',
        sentAt: new Date(),
        status: smsResult.status,
        message: smsMessage
      });
    }

    // Send Email if enabled
    if (email && notificationPreferences?.email?.transactionAlerts) {
      const emailResult = await this.sendEmail(email, emailSubject, emailHtml);
      notifications.push({
        type: 'EMAIL',
        sentAt: new Date(),
        status: emailResult.status,
        message: emailSubject
      });
    }

    // Always create in-app notification
    notifications.push({
      type: 'IN_APP',
      sentAt: new Date(),
      status: 'sent',
      message: smsMessage
    });

    return notifications;
  }

  /**
   * Send account frozen alert
   */
  async sendAccountFrozenAlert(user, reason, transaction = null) {
    const notifications = [];

    const smsMessage = `🛑 URGENT: Your account has been FROZEN due to ${reason}. Please contact support immediately to unfreeze. Ref: ${transaction?.transactionId || 'N/A'}`;
    
    const emailSubject = '🛑 URGENT: Account Frozen - Security Alert';
    const emailHtml = this.generateAccountFrozenEmail(transaction, user, reason);

    // ALWAYS send critical alerts regardless of preferences
    if (user.phoneNumber) {
      const smsResult = await this.sendSMS(user.phoneNumber, smsMessage);
      notifications.push({
        type: 'SMS',
        sentAt: new Date(),
        status: smsResult.status,
        message: smsMessage
      });
    }

    if (user.email) {
      const emailResult = await this.sendEmail(user.email, emailSubject, emailHtml);
      notifications.push({
        type: 'EMAIL',
        sentAt: new Date(),
        status: emailResult.status,
        message: emailSubject
      });
    }

    return notifications;
  }

  /**
   * Email Templates
   */
  generateTransactionSuccessEmail(transaction) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">✅ Transaction Successful</h2>
        <p>Your payment has been processed successfully.</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
          <p><strong>Amount:</strong> ₹${transaction.amount}</p>
          <p><strong>To:</strong> ${transaction.receiverUPI}</p>
          <p><strong>Date:</strong> ${new Date(transaction.initiatedAt).toLocaleString()}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 12px;">
          If you didn't make this transaction, please contact support immediately.
        </p>
      </div>
    `;
  }

  generateSuspiciousTransactionEmail(transaction) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">⚠️ Suspicious Transaction Detected</h2>
        <p>We detected unusual activity on your account.</p>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
          <p><strong>Amount:</strong> ₹${transaction.amount}</p>
          <p><strong>To:</strong> ${transaction.receiverUPI}</p>
          <p><strong>Risk Score:</strong> ${transaction.fraudCheck.riskScore}/100</p>
          <p><strong>Status:</strong> ${transaction.status.toUpperCase()}</p>
        </div>
        
        <h3>Risk Factors Detected:</h3>
        <ul>
          ${transaction.fraudCheck.riskFactors.map(factor => `<li>${factor}</li>`).join('')}
        </ul>
        
        <p style="color: #dc2626; font-weight: bold;">
          If you didn't initiate this transaction, please contact support immediately.
        </p>
      </div>
    `;
  }

  generateHighRiskTransactionEmail(transaction) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">🚨 High Risk Transaction Alert</h2>
        <p style="color: #dc2626; font-weight: bold;">
          A high-risk transaction attempt was detected on your account.
        </p>
        
        <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
          <p><strong>Amount:</strong> ₹${transaction.amount}</p>
          <p><strong>To:</strong> ${transaction.receiverUPI}</p>
          <p><strong>Risk Score:</strong> ${transaction.fraudCheck.riskScore}/100</p>
          <p><strong>Status:</strong> <span style="color: #dc2626;">${transaction.status.toUpperCase()}</span></p>
        </div>
        
        <h3>Security Concerns:</h3>
        <ul>
          ${transaction.fraudCheck.riskFactors.map(factor => `<li style="color: #dc2626;">${factor}</li>`).join('')}
        </ul>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <h4>What's Next?</h4>
          <p>This transaction has been flagged for review. Our security team will investigate.</p>
          <p>If this wasn't you, please contact support immediately at <strong>support@example.com</strong></p>
        </div>
      </div>
    `;
  }

  generateAccountFrozenEmail(transaction, user, reason = 'suspicious activity') {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🛑 CRITICAL SECURITY ALERT</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Your Account Has Been Frozen</p>
        </div>
        
        <div style="padding: 20px; border: 2px solid #dc2626; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #dc2626; font-weight: bold; font-size: 16px;">
            Your account has been temporarily frozen due to ${reason}.
          </p>
          
          ${transaction ? `
          <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc2626;">Blocked Transaction Details:</h3>
            <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
            <p><strong>Amount:</strong> ₹${transaction.amount}</p>
            <p><strong>To:</strong> ${transaction.receiverUPI}</p>
            <p><strong>Risk Score:</strong> ${transaction.fraudCheck.riskScore}/100 (CRITICAL)</p>
          </div>
          
          <h3>Why was this blocked?</h3>
          <ul>
            ${transaction.fraudCheck.riskFactors.map(factor => `<li style="color: #dc2626;">${factor}</li>`).join('')}
          </ul>
          ` : ''}
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0;">⚠️ What You Need to Do:</h4>
            <ol>
              <li>Verify your recent transactions</li>
              <li>Check if your SIM card or device was recently changed</li>
              <li>Contact our support team immediately</li>
              <li>DO NOT share your account details with anyone</li>
            </ol>
          </div>
          
          <div style="background: #1f2937; color: white; padding: 15px; border-radius: 8px; text-align: center;">
            <h3 style="margin-top: 0;">Contact Support</h3>
            <p>Email: support@example.com</p>
            <p>Phone: 1800-XXX-XXXX (24/7)</p>
            <p style="font-size: 12px; margin-bottom: 0;">
              Your account will remain frozen until verified by our team.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            This is an automated security alert. If you believe this is a mistake, please contact support immediately.
          </p>
        </div>
      </div>
    `;
  }

  generateGenericTransactionEmail(transaction) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Transaction Update</h2>
        <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
        <p><strong>Amount:</strong> ₹${transaction.amount}</p>
        <p><strong>Status:</strong> ${transaction.status}</p>
      </div>
    `;
  }
}

export default NotificationService;
