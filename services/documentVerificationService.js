import tesseract from 'tesseract.js';
import sharp from 'sharp';

class DocumentVerificationService {
  constructor() {
    this.supportedFormats = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
    this.fraudPatterns = {
      suspiciousWords: [
        'edited', 'modified', 'photoshop', 'fake', 'duplicate',
        'sample', 'specimen', 'copy', 'draft', 'template', 'watermark'
      ]
    };
  }

  // Main document verification function
  async verifyDocument(fileBuffer, documentType, fileName = 'document') {
    try {
      console.log(`🔍 Starting verification for ${documentType} document: ${fileName}`);
      
      // Step 1: Image quality analysis
      const imageAnalysis = await this.analyzeImageQuality(fileBuffer);
      
      // Step 2: OCR text extraction
      const ocrResult = await this.extractTextWithTesseract(fileBuffer);
      
      // Step 3: Document-specific verification
      const documentAnalysis = await this.analyzeDocumentByType(
        ocrResult.extractedText, 
        documentType
      );
      
      // Step 4: Fraud detection
      const fraudAnalysis = await this.detectFraudIndicators(
        ocrResult.extractedText,
        imageAnalysis,
        documentType
      );
      
      // Step 5: Calculate overall confidence and validity
      const overallResult = this.calculateOverallResult({
        ocrResult,
        documentAnalysis,
        fraudAnalysis,
        imageAnalysis
      });
      
      return {
        success: true,
        documentType,
        fileName,
        verification: {
          isValid: overallResult.isValid,
          confidence: overallResult.confidence,
          riskScore: overallResult.riskScore,
          riskLevel: overallResult.riskLevel
        },
        extractedData: documentAnalysis.extractedData,
        fraudIndicators: fraudAnalysis.indicators,
        warnings: fraudAnalysis.warnings,
        ocrDetails: {
          confidence: ocrResult.confidence,
          processingTime: ocrResult.processingTime,
          wordCount: ocrResult.wordCount
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Document verification error:', error);
      return {
        success: false,
        error: error.message,
        verification: {
          isValid: false,
          confidence: 0,
          riskScore: 100,
          riskLevel: 'CRITICAL'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  // Tesseract OCR extraction with optimization
  async extractTextWithTesseract(imageBuffer) {
    try {
      const startTime = Date.now();
      
      const { data } = await tesseract.recognize(imageBuffer, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: '6', // Uniform block of text
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/-:., ()',
      });

      const processingTime = Date.now() - startTime;
      
      return {
        extractedText: data.text.trim(),
        confidence: data.confidence,
        wordCount: data.words ? data.words.length : 0,
        lineCount: data.lines ? data.lines.length : 0,
        processingTime: `${processingTime}ms`
      };

    } catch (error) {
      console.error('Tesseract OCR error:', error);
      return {
        extractedText: '',
        confidence: 0,
        wordCount: 0,
        lineCount: 0,
        processingTime: '0ms',
        error: error.message
      };
    }
  }

  // Image quality analysis for tampering detection
  async analyzeImageQuality(fileBuffer) {
    try {
      const image = sharp(fileBuffer);
      const metadata = await image.metadata();
      const stats = await image.stats();
      
      const qualityIndicators = {
        resolution: {
          width: metadata.width,
          height: metadata.height,
          density: metadata.density || 72,
          isLowResolution: metadata.width < 800 || metadata.height < 600
        },
        compression: {
          format: metadata.format,
          quality: this.estimateImageQuality(stats),
          isHighlyCompressed: this.estimateImageQuality(stats) < 50
        },
        consistency: {
          brightnessVariance: stats.channels[0].std,
          suspiciousEditing: this.detectSuspiciousEditing(stats)
        }
      };

      const fraudIndicators = [];
      if (qualityIndicators.resolution.isLowResolution) {
        fraudIndicators.push('Suspiciously low resolution - possible screenshot');
      }
      if (qualityIndicators.compression.isHighlyCompressed) {
        fraudIndicators.push('High compression - possible re-encoding after editing');
      }
      if (qualityIndicators.consistency.suspiciousEditing) {
        fraudIndicators.push('Inconsistent image properties - possible tampering');
      }

      return {
        ...qualityIndicators,
        fraudIndicators,
        riskScore: fraudIndicators.length * 15
      };

    } catch (error) {
      return {
        error: 'Image analysis failed',
        riskScore: 25,
        fraudIndicators: ['Failed to analyze image quality']
      };
    }
  }

  // Document-specific analysis
  async analyzeDocumentByType(extractedText, documentType) {
    switch (documentType.toLowerCase()) {
      case 'aadhaar':
        return this.analyzeAadhaarCard(extractedText);
      case 'pan':
        return this.analyzePANCard(extractedText);
      case 'driving_license':
        return this.analyzeDrivingLicense(extractedText);
      case 'bank_statement':
        return this.analyzeBankStatement(extractedText);
      case 'salary_slip':
        return this.analyzeSalarySlip(extractedText);
      default:
        return this.genericDocumentAnalysis(extractedText);
    }
  }

  // Aadhaar Card specific verification
  analyzeAadhaarCard(text) {
    const patterns = {
      aadhaarNumber: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
      name: /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/gm,
      dob: /\b\d{2}\/\d{2}\/\d{4}\b/g,
      gender: /(MALE|FEMALE)/gi,
      govtOfIndia: /GOVERNMENT\s+OF\s+INDIA/gi,
      uid: /Unique\s+Identification\s+Authority/gi,
      address: /Address[:\s]*(.+)/gi
    };

    const matches = {
      aadhaarNumber: text.match(patterns.aadhaarNumber),
      name: text.match(patterns.name),
      dob: text.match(patterns.dob),
      gender: text.match(patterns.gender),
      hasGovtOfIndia: patterns.govtOfIndia.test(text),
      hasUID: patterns.uid.test(text),
      address: text.match(patterns.address)
    };

    // Check for invalid Aadhaar numbers (common fraud patterns)
    const invalidNumbers = ['000000000000', '111111111111', '123456789012'];
    const isValidNumber = matches.aadhaarNumber && 
      !invalidNumbers.includes(matches.aadhaarNumber[0].replace(/\s/g, ''));

    let confidence = 0;
    if (isValidNumber) confidence += 30;
    if (matches.hasGovtOfIndia) confidence += 25;
    if (matches.hasUID) confidence += 20;
    if (matches.dob) confidence += 15;
    if (matches.gender) confidence += 10;

    return {
      extractedData: {
        aadhaarNumber: matches.aadhaarNumber?.[0]?.replace(/\s/g, ''),
        name: matches.name?.[0],
        dateOfBirth: matches.dob?.[0],
        gender: matches.gender?.[0]?.toUpperCase(),
        address: matches.address?.[1]
      },
      confidence: Math.min(confidence, 100),
      isValid: confidence >= 50,
      checks: {
        hasValidAadhaarNumber: isValidNumber,
        hasGovernmentText: matches.hasGovtOfIndia,
        hasUIDText: matches.hasUID,
        hasPersonalInfo: !!(matches.name && matches.dob)
      }
    };
  }

  // PAN Card specific verification
  analyzePANCard(text) {
    const patterns = {
      panNumber: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g,
      name: /^[A-Z][A-Z\s]+$/gm,
      fatherName: /Father['\s]*s?\s*Name[:\s]*([A-Z\s]+)/gi,
      dob: /\b\d{2}\/\d{2}\/\d{4}\b/g,
      incomeTax: /INCOME\s+TAX\s+DEPARTMENT/gi,
      govtOfIndia: /GOVT\.\s+OF\s+INDIA/gi
    };

    const matches = {
      panNumber: text.match(patterns.panNumber),
      name: text.match(patterns.name),
      fatherName: text.match(patterns.fatherName),
      dob: text.match(patterns.dob),
      hasIncomeTax: patterns.incomeTax.test(text),
      hasGovtOfIndia: patterns.govtOfIndia.test(text)
    };

    // Check for invalid PAN numbers
    const invalidPANs = ['AAAAA0000A', 'BBBBB1111B', 'SAMPLE123A'];
    const isValidPAN = matches.panNumber && 
      !invalidPANs.includes(matches.panNumber[0]);

    let confidence = 0;
    if (isValidPAN) confidence += 40;
    if (matches.hasIncomeTax) confidence += 30;
    if (matches.hasGovtOfIndia) confidence += 20;
    if (matches.dob) confidence += 10;

    return {
      extractedData: {
        panNumber: matches.panNumber?.[0],
        name: matches.name?.find(name => name.length > 3),
        fatherName: matches.fatherName?.[1],
        dateOfBirth: matches.dob?.[0]
      },
      confidence: Math.min(confidence, 100),
      isValid: confidence >= 60,
      checks: {
        hasValidPANNumber: isValidPAN,
        hasIncomeTaxText: matches.hasIncomeTax,
        hasGovernmentText: matches.hasGovtOfIndia,
        hasPersonalInfo: !!(matches.name || matches.dob)
      }
    };
  }

  // Bank Statement verification  
  analyzeBankStatement(text) {
    const patterns = {
      accountNumber: /Account\s+No[.:]?\s*(\d{9,18})/gi,
      ifscCode: /IFSC[:\s]*([A-Z]{4}0[A-Z0-9]{6})/gi,
      bankName: /(HDFC|ICICI|SBI|AXIS|KOTAK|PNB|BOI|CANARA|UNION)\s+BANK/gi,
      balance: /Balance[:\s]*Rs\.?\s*([\d,]+\.?\d*)/gi,
      transactions: /\d{2}\/\d{2}\/\d{4}\s+.*?\s+([\d,]+\.?\d*)/g,
      holderName: /Account\s+Holder[:\s]*([A-Z\s]+)/gi,
      statementPeriod: /Statement\s+Period[:\s]*(\d{2}\/\d{2}\/\d{4})\s*to\s*(\d{2}\/\d{2}\/\d{4})/gi
    };

    const matches = {
      accountNumber: text.match(patterns.accountNumber),
      ifscCode: text.match(patterns.ifscCode),
      bankName: text.match(patterns.bankName),
      balance: text.match(patterns.balance),
      transactions: text.match(patterns.transactions),
      holderName: text.match(patterns.holderName),
      statementPeriod: text.match(patterns.statementPeriod)
    };

    let confidence = 0;
    if (matches.accountNumber) confidence += 25;
    if (matches.bankName) confidence += 25;
    if (matches.ifscCode) confidence += 20;
    if (matches.balance) confidence += 15;
    if (matches.transactions && matches.transactions.length > 0) confidence += 15;

    return {
      extractedData: {
        accountNumber: matches.accountNumber?.[1],
        ifscCode: matches.ifscCode?.[1],
        bankName: matches.bankName?.[0],
        currentBalance: matches.balance?.[1],
        accountHolder: matches.holderName?.[1],
        transactionCount: matches.transactions?.length || 0,
        statementPeriod: matches.statementPeriod?.[0]
      },
      confidence: Math.min(confidence, 100),
      isValid: confidence >= 60,
      checks: {
        hasAccountNumber: !!matches.accountNumber,
        hasBankName: !!matches.bankName,
        hasIFSC: !!matches.ifscCode,
        hasTransactions: !!(matches.transactions && matches.transactions.length > 0),
        hasBalance: !!matches.balance
      }
    };
  }

  // Fraud detection analysis
  async detectFraudIndicators(text, imageAnalysis, documentType) {
    const indicators = [];
    const warnings = [];
    let riskScore = 0;

    // Text-based fraud detection
    const lowerText = text.toLowerCase();
    
    // Check for suspicious words
    this.fraudPatterns.suspiciousWords.forEach(word => {
      if (lowerText.includes(word)) {
        indicators.push(`Suspicious text found: "${word}"`);
        riskScore += 20;
      }
    });

    // Check for insufficient content
    if (text.length < 100) {
      warnings.push('Document text seems too short - image quality might be poor');
      riskScore += 10;
    }

    // Check for unrecognized characters (OCR artifacts)
    if (text.includes('???') || text.includes('|||') || text.includes('□')) {
      warnings.push('Some characters could not be recognized - scan quality issue');
      riskScore += 5;
    }

    // Add image analysis fraud indicators
    if (imageAnalysis.fraudIndicators) {
      indicators.push(...imageAnalysis.fraudIndicators);
      riskScore += imageAnalysis.riskScore || 0;
    }

    // Document type specific fraud checks
    if (documentType === 'aadhaar') {
      if (lowerText.includes('specimen') || lowerText.includes('sample')) {
        indicators.push('Document appears to be a specimen/sample');
        riskScore += 30;
      }
    }

    return {
      indicators,
      warnings,
      riskScore: Math.min(riskScore, 100),
      riskLevel: riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW'
    };
  }

  // Calculate overall result
  calculateOverallResult({ ocrResult, documentAnalysis, fraudAnalysis, imageAnalysis }) {
    let baseConfidence = Math.min(
      ocrResult.confidence || 0,
      documentAnalysis.confidence || 0
    );

    // Reduce confidence based on fraud indicators
    const fraudPenalty = fraudAnalysis.riskScore * 0.5; // 0.5% penalty per risk point
    const adjustedConfidence = Math.max(0, baseConfidence - fraudPenalty);

    const isValid = documentAnalysis.isValid && 
                   fraudAnalysis.riskScore < 70 && 
                   adjustedConfidence > 30;

    return {
      isValid,
      confidence: Math.round(adjustedConfidence),
      riskScore: fraudAnalysis.riskScore,
      riskLevel: fraudAnalysis.riskLevel
    };
  }

  // Generic document analysis
  genericDocumentAnalysis(text) {
    return {
      extractedData: {
        textContent: text.substring(0, 500),
        wordCount: text.split(' ').length,
        hasContent: text.length > 50
      },
      confidence: text.length > 50 ? 60 : 20,
      isValid: text.length > 50,
      checks: {
        hasMinimumContent: text.length > 50,
        isReadable: text.length > 20
      }
    };
  }

  // Utility functions
  estimateImageQuality(stats) {
    const avgVariance = stats.channels.reduce((sum, channel) => sum + channel.std, 0) / stats.channels.length;
    return Math.min(100, avgVariance * 2);
  }

  detectSuspiciousEditing(stats) {
    const variances = stats.channels.map(channel => channel.std);
    const maxVariance = Math.max(...variances);
    const minVariance = Math.min(...variances);
    return (maxVariance / minVariance) > 3;
  }
}

export default DocumentVerificationService;