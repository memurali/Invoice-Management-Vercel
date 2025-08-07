# Invoice Management System

An AI-powered invoice management system for Green Earth that automates invoice parsing, data reconciliation, and discrepancy detection.

## 🚀 Project Overview

Green Earth regularly delivers commodities to vendors who send invoices at the end of each billing cycle. This system automates the reconciliation process by:

- **AI-powered OCR**: Parses invoice PDFs and extracts structured data
- **Data Matching**: Compares vendor invoices with internal drop-off records
- **Discrepancy Detection**: Automatically flags mismatches and missing entries
- **Secure Dashboard**: Web-based interface for managing and reviewing invoices
- **Comprehensive Reporting**: Generates detailed audit reports

## 🎨 Brand Colors

- Primary Green: `#64A950`
- Primary Blue: `#1F76B9`

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Firebase (Firestore, Authentication)
- **OCR**: FastAPI Endpoint (External)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Email**: EmailJS

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoice-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3500`

## 🚀 Available Scripts

- `npm run dev` - Start development server on port 3500
- `npm run build` - Build for production
- `npm run start` - Start production server on port 3500
- `npm run lint` - Run ESLint
- `npm run analyze` - Analyze invoice data
- `npm run analyze-firebase` - Analyze Firebase data

## 🔧 Firebase Configuration

### Firestore Rules
Ensure your Firestore security rules are properly configured for:
- User authentication
- Invoice data access control
- Vendor record management

### Authentication
The system uses Firebase Authentication for user management and access control.

## 📁 Project Structure

```
src/
├── app/          # Next.js app router pages
├── components/   # React components
├── hooks/        # Custom React hooks
├── lib/          # Utility functions and configurations
public/
├── favicon_io/   # Favicon assets
├── logo_icon.png # Application logo
└── logo_complete.png # Complete logo
```

## 🔍 Key Features

### Milestone 1 Implementation
- ✅ User authentication and access controls
- ✅ Upload and manage invoice PDFs
- ✅ AI-powered OCR data extraction
- ✅ Secure data storage in Firebase
- ✅ Drop-off records integration
- ✅ Comparison engine for audit matching
- ✅ Automatic discrepancy detection
- ✅ Comprehensive reporting dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is private and proprietary to Green Earth.

## 🆘 Support

For technical support or questions, please contact the development team.
