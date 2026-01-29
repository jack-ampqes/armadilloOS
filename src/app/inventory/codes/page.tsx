'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QrCode, ScanLine, Barcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import JSZip from 'jszip';

interface QRCodeData {
  sku: string;
  name: string;
  qrCode: string;
}

type ViewType = 'qr' | 'barcode';

export default function QRCodesPage() {
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<ViewType>('qr');

  useEffect(() => {
    fetchQRCodes();
  }, [viewType]);

  const fetchQRCodes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/codes?type=${viewType}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          message: data.message,
          details: data.details,
          code: data.code,
          hint: data.hint
        });
        // If it's just no products, that's okay - show empty state
        if (data.error?.includes('Database error') || data.code) {
          console.error('Database connection issue:', {
            code: data.code,
            message: data.message || data.details,
            hint: data.hint
          });
        }
        setQrCodes([]);
        return;
      }
      
      // Ensure codes is always an array (prefer 'codes', fallback to 'qrCodes' for backward compatibility)
      setQrCodes(Array.isArray(data.codes) ? data.codes : (Array.isArray(data.qrCodes) ? data.qrCodes : []));
    } catch (error) {
      console.error('Failed to fetch codes:', error);
      setQrCodes([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = (sku: string, code: string, name: string) => {
    const link = document.createElement('a');
    link.href = code;
    const prefix = viewType === 'barcode' ? 'Barcode' : 'QR';
    link.download = `${prefix}_${sku}_${name.replace(/[^a-z0-9]/gi, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllQRCodes = async () => {
    if (!qrCodes || qrCodes.length === 0) return;

    try {
      const zip = new JSZip();
      const prefix = viewType === 'barcode' ? 'Barcode' : 'QR';
      
      // Add each code to the zip file
      for (const item of qrCodes) {
        // Convert data URL to blob
        const response = await fetch(item.qrCode);
        const blob = await response.blob();
        
        // Create a safe filename
        const filename = `${prefix}_${item.sku}_${item.name.replace(/[^a-z0-9]/gi, '_')}.png`;
        
        // Add to zip
        zip.file(filename, blob);
      }
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the zip file
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${prefix}_Codes_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error creating zip file:', error);
      alert('Failed to create zip file. Please try again.');
    }
  };

  const printQRCode = (sku: string) => {
    const printWindow = window.open('', '_blank');
    const codeData = (qrCodes || []).find(q => q.sku === sku);
    
    if (printWindow && codeData) {
      const codeType = viewType === 'barcode' ? 'Barcode' : 'QR Code';
      const imgStyle = viewType === 'barcode' 
        ? 'width: 100%; max-width: 400px; height: auto;' 
        : 'width: 300px; height: 300px;';
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${codeType} - ${codeData.sku}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px;
              }
              .code-container {
                display: inline-block;
                border: 2px solid #000;
                padding: 20px;
                margin: 20px;
              }
              img { 
                ${imgStyle}
              }
              h2 { margin: 10px 0; }
              p { margin: 5px 0; }
            </style>
          </head>
          <body>
            <div class="code-container">
              <h2>${codeData.name}</h2>
              <p><strong>SKU: ${codeData.sku}</strong></p>
              <img src="${codeData.qrCode}" alt="${codeType} for ${codeData.sku}" />
              <p>${viewType === 'barcode' ? 'Scan barcode to manage inventory' : 'Scan to manage inventory'}</p>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const filteredQRCodes = (qrCodes || []).filter(
    (item) =>
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-white">Product Codes</h1>
        
        <div className="flex gap-4 mb-4">
          <div className="relative inline-flex items-center rounded-lg bg-transparent p-1 gap-2">
            {/* Sliding background indicator */}
            <div
              className={`absolute h-8 bg-white/20 rounded-md transition-all duration-300 ease-in-out ${
                viewType === 'qr' ? 'left-[0.25rem]' : 'left-[calc(50%+0.25rem)]'
              }`}
              style={{
                width: 'calc(50% - 0.5rem)',
              }}
            />
            {/* Toggle buttons */}
            <button
              onClick={() => setViewType('qr')}
              className="relative z-10 px-4 h-8 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none text-center flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              QR Codes
            </button>
            <button
              onClick={() => setViewType('barcode')}
              className="relative z-10 px-4 h-8 text-sm font-medium rounded-md transition-colors duration-200 whitespace-nowrap text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none text-center flex items-center justify-center gap-2"
            >
              <Barcode className="w-4 h-4" />
              Barcodes
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <Input
            type="text"
            placeholder="Search by SKU or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button onClick={downloadAllQRCodes} className="whitespace-nowrap">
            Download All ({filteredQRCodes.length})
          </Button>
          <Button variant="secondary" asChild className="whitespace-nowrap">
            <Link href="/inventory">Back to Inventory</Link>
          </Button>
        </div>
      </div>

      <div className="relative min-h-[400px]">
        {loading && qrCodes.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <>
            {loading && qrCodes.length > 0 && (
              <div className="absolute inset-0 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg shadow-lg border border-white/20">
                  <div className="w-6 h-6 border-2 border-white/80 border-t-white rounded-full animate-spin"></div>
                  <p className="text-sm text-white font-medium">Loading {viewType === 'barcode' ? 'barcodes' : 'QR codes'}...</p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredQRCodes.map((item) => (
                <Card key={item.sku} className={`hover:shadow-md transition-shadow ${loading ? 'opacity-60' : 'opacity-100'}`}>
                  <CardContent className="p-4">
                  <div className="text-center mb-3">
                    <p className="text-xs font-normal text-white/90 line-clamp-2 mb-1" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-xs text-white/60 font-mono">{item.sku}</p>
                  </div>
                  
                  <div className={`p-2 rounded mb-3 flex items-center justify-center`}>
                    <img
                      src={item.qrCode}
                      alt={`${viewType === 'barcode' ? 'Barcode' : 'QR Code'} for ${item.sku}`}
                      className={`${viewType === 'barcode' ? 'w-64 h-16' : 'w-48 h-48'} object-contain`}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => downloadQRCode(item.sku, item.qrCode, item.name)}
                      className="flex-1"
                      variant="default"
                      disabled={loading}
                    >
                      Download
                    </Button>
                    <Button
                      onClick={() => printQRCode(item.sku)}
                      className="flex-1"
                      variant="default"
                      disabled={loading}
                    >
                      Print
                    </Button>
                  </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredQRCodes.length === 0 && !loading && (
              <div className="text-center py-12 text-white/60">
                {searchTerm ? 'No products found matching your search.' : 'No products available.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

