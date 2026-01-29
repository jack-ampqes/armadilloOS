'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/lib/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';

function InventoryScanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sku = searchParams.get('sku');

  const [product, setProduct] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { hasPermission, role } = usePermissions();

  useEffect(() => {
    // Only redirect once we know the role; while role is null (cookie not read yet) stay on page
    if (role !== null && !hasPermission('QrCodesBarcodes')) {
      router.push('/inventory');
      return;
    }
    if (sku) {
      fetchProductAndInventory();
    }
  }, [sku, role, hasPermission]);

  const fetchProductAndInventory = async () => {
    try {
      // Fetch product
      const productResponse = await fetch(`/api/products?sku=${sku}`);
      const productData = await productResponse.json();
      
      if (productData.products && productData.products.length > 0) {
        const prod = productData.products[0];
        setProduct(prod);

        // Fetch inventory
        const inventoryResponse = await fetch(`/api/inventory?productId=${prod.id}`);
        const inventoryData = await inventoryResponse.json();
        setInventory(inventoryData.inventory.find((inv: any) => inv.productId === prod.id) || null);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMessage({ type: 'error', text: 'Failed to load product information' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustInventory = async (action: 'add' | 'remove') => {
    if (!product) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const currentQuantity = inventory?.quantity || 0;
      const newQuantity = action === 'add' 
        ? currentQuantity + adjustmentAmount 
        : Math.max(0, currentQuantity - adjustmentAmount);

      const payload = {
        productId: product.id,
        quantity: newQuantity,
        location: inventory?.location || 'Main Warehouse',
        minStock: inventory?.minStock || 0,
      };

      let response;
      if (inventory) {
        // Update existing inventory
        response = await fetch(`/api/inventory/${inventory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new inventory record
        response = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        const actionText = action === 'add' ? 'Added' : 'Removed';
        setMessage({ 
          type: 'success', 
          text: `${actionText} ${adjustmentAmount} unit(s). New quantity: ${newQuantity}` 
        });
        
        // Refresh inventory data
        await fetchProductAndInventory();
        
        // Reset form
        setAdjustmentAmount(1);
        setNote('');
      } else {
        throw new Error('Failed to update inventory');
      }
    } catch (error) {
      console.error('Inventory update error:', error);
      setMessage({ type: 'error', text: 'Failed to update inventory' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading product information...</p>
        </div>
      </div>
    );
  }

  if (!sku || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="text-6xl mb-4">📦</div>
            <h1 className="text-2xl font-bold mb-4 text-white">Product Not Found</h1>
            <p className="text-gray-400 mb-6">
              The QR code you scanned is invalid or the product doesn't exist.
            </p>
            <Button asChild>
              <Link href="/inventory">Go to Inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuantity = inventory?.quantity || 0;

  return (
    <div className="min-h-screen bg-[#181818] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Inventory Scan</CardTitle>
              <Button variant="ghost" asChild>
                <Link href="/inventory">← Back to Inventory</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-t border-black/9 pt-4">
              <h2 className="text-xl font-semibold mb-2 text-white">{product.name}</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">SKU:</span>
                  <span className="ml-2 font-mono font-semibold text-white">{product.sku}</span>
                </div>
                <div>
                  <span className="text-gray-400">Price:</span>
                  <span className="ml-2 font-semibold text-white">${product.price.toFixed(2)}</span>
                </div>
              </div>
              {product.description && (
                <p className="text-sm text-gray-400 mt-2">{product.description}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Inventory */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Current Stock Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-400 mb-2">
                {currentQuantity}
              </div>
              <div className="text-gray-400">units in stock</div>
              {inventory?.location && (
                <div className="text-sm text-gray-500 mt-2">
                  Location: {inventory.location}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Adjustment Controls */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Adjust Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Label>Quantity to Add/Remove</Label>
              <Input
                type="number"
                min="1"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-2 text-lg"
              />
            </div>

            <div className="mb-6">
              <Label>Note (Optional)</Label>
              <Input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Received shipment, Sold to customer..."
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleAdjustInventory('add')}
                disabled={submitting}
                className="w-full py-4 font-semibold text-lg"
                variant="default"
              >
                {submitting ? 'Updating...' : `+ Add ${adjustmentAmount}`}
              </Button>
              <Button
                onClick={() => handleAdjustInventory('remove')}
                disabled={submitting || currentQuantity === 0}
                className="w-full py-4 font-semibold text-lg bg-red-600 hover:bg-red-700"
              >
                {submitting ? 'Updating...' : `- Remove ${adjustmentAmount}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Message */}
        {message && (
          <div
            className={`rounded-lg p-4 mb-4 border-t border-black/9 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" asChild>
                <Link href={`/inventory/codes`}>📱 View All Codes</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/inventory`}>📊 Inventory Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function InventoryScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    }>
      <InventoryScanContent />
    </Suspense>
  );
}

