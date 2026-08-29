'use client';

/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Phase 4 Revenue & Commercial Layer - Rule 10):
 * - ProductCatalogModal provides the workspace-level administrative console for managing Products, Categories, and Price Books.
 * - Enforces zero 'any' typing, min-h-[44px] touch targets, and accessible ARIA attributes.
 * - Connects directly with product-actions.ts for server-validated CRUD operations.
 * 
 * Caution Areas for Future Maintainers:
 * - Product modifications do not mutate historic deal snapshots.
 * - Category deletions should ensure products with that category gracefully fallback to unassigned.
 */

import * as React from 'react';
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  Tag, 
  DollarSign, 
  Repeat, 
  Percent, 
  Search, 
  Loader2, 
  Check, 
  X, 
  Layers, 
  BookOpen,
  Filter
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Product, ProductCategory, PriceBook } from '@/lib/types';
import { 
  createProductAction, 
  updateProductAction, 
  deleteProductAction, 
  listProductsAction,
  createProductCategoryAction,
  listProductCategoriesAction,
  createPriceBookAction,
  listPriceBooksAction
} from '@/app/actions/product-actions';
import { formatCurrency } from '@/lib/currency-utils';

interface ProductCatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductCatalogModal({ open, onOpenChange }: ProductCatalogModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState<'products' | 'categories' | 'price_books'>('products');
  const [isLoading, setIsLoading] = React.useState(true);

  // Data lists
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [priceBooks, setPriceBooks] = React.useState<PriceBook[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('all');

  // Product Form Submodal State
  const [isProductFormOpen, setIsProductFormOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = React.useState(false);

  // Product Form Fields
  const [prodName, setProdName] = React.useState('');
  const [prodSku, setProdSku] = React.useState('');
  const [prodDescription, setProdDescription] = React.useState('');
  const [prodCategoryId, setProdCategoryId] = React.useState('none');
  const [prodUnitPrice, setProdUnitPrice] = React.useState('0');
  const [prodCurrency, setProdCurrency] = React.useState('USD');
  const [prodIsRecurring, setProdIsRecurring] = React.useState(false);
  const [prodBillingInterval, setProdBillingInterval] = React.useState<'one_time' | 'monthly' | 'quarterly' | 'annual'>('monthly');
  const [prodTaxRate, setProdTaxRate] = React.useState('0');

  // Category Form State
  const [isCategoryFormOpen, setIsCategoryFormOpen] = React.useState(false);
  const [catName, setCatName] = React.useState('');
  const [catDescription, setCatDescription] = React.useState('');
  const [catColor, setCatColor] = React.useState('#4f46e5');
  const [isSubmittingCategory, setIsSubmittingCategory] = React.useState(false);

  // Price Book Form State
  const [isPriceBookFormOpen, setIsPriceBookFormOpen] = React.useState(false);
  const [pbName, setPbName] = React.useState('');
  const [pbDescription, setPbDescription] = React.useState('');
  const [pbCurrency, setPbCurrency] = React.useState('USD');
  const [pbIsStandard, setPbIsStandard] = React.useState(false);
  const [isSubmittingPriceBook, setIsSubmittingPriceBook] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const [prodRes, catRes, pbRes] = await Promise.all([
        listProductsAction(activeWorkspaceId, true),
        listProductCategoriesAction(activeWorkspaceId),
        listPriceBooksAction(activeWorkspaceId),
      ]);

      if (prodRes.success && prodRes.products) setProducts(prodRes.products);
      if (catRes.success && catRes.categories) setCategories(catRes.categories);
      if (pbRes.success && pbRes.priceBooks) setPriceBooks(pbRes.priceBooks);
    } catch (err) {
      console.error('Failed to load product catalog data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdDescription('');
    setProdCategoryId('none');
    setProdUnitPrice('0');
    setProdCurrency('USD');
    setProdIsRecurring(false);
    setProdBillingInterval('monthly');
    setProdTaxRate('0');
    setIsProductFormOpen(true);
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdSku(product.sku || '');
    setProdDescription(product.description || '');
    setProdCategoryId(product.categoryId || 'none');
    setProdUnitPrice(product.unitPrice.toString());
    setProdCurrency(product.currency || 'USD');
    setProdIsRecurring(product.isRecurring);
    setProdBillingInterval(product.billingInterval || 'monthly');
    setProdTaxRate((product.taxRate || 0).toString());
    setIsProductFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) return;

    setIsSubmittingProduct(true);
    try {
      const categoryObj = categories.find(c => c.id === prodCategoryId);
      const payload = {
        name: prodName.trim(),
        sku: prodSku.trim() || undefined,
        description: prodDescription.trim() || undefined,
        categoryId: prodCategoryId !== 'none' ? prodCategoryId : undefined,
        categoryName: categoryObj ? categoryObj.name : undefined,
        unitPrice: parseFloat(prodUnitPrice) || 0,
        currency: prodCurrency,
        isRecurring: prodIsRecurring,
        billingInterval: prodIsRecurring ? prodBillingInterval : 'one_time',
        taxRate: parseFloat(prodTaxRate) || 0,
        isActive: true,
      };

      let res;
      if (editingProduct) {
        res = await updateProductAction(editingProduct.id, payload, user.uid, activeWorkspaceId);
      } else {
        res = await createProductAction(payload, user.uid, activeWorkspaceId, activeOrganizationId || 'default');
      }

      if (res.success) {
        toast({
          title: editingProduct ? 'Product Updated' : 'Product Created',
          description: `"${payload.name}" has been saved to the workspace catalog.`,
        });
        setIsProductFormOpen(false);
        loadData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error || 'Failed to save product.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user || !activeWorkspaceId) return;
    try {
      const res = await deleteProductAction(productId, user.uid, activeWorkspaceId);
      if (res.success) {
        toast({ title: 'Product Archived', description: 'Product has been deactivated from catalog.' });
        loadData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to archive product.' });
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) return;

    setIsSubmittingCategory(true);
    try {
      const res = await createProductCategoryAction(
        { name: catName.trim(), description: catDescription.trim() || undefined, color: catColor },
        user.uid,
        activeWorkspaceId,
        activeOrganizationId || 'default'
      );

      if (res.success) {
        toast({ title: 'Category Created', description: `Category "${catName}" added.` });
        setCatName('');
        setCatDescription('');
        setIsCategoryFormOpen(false);
        loadData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create category.' });
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleSavePriceBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) return;

    setIsSubmittingPriceBook(true);
    try {
      const res = await createPriceBookAction(
        { name: pbName.trim(), description: pbDescription.trim() || undefined, currency: pbCurrency, isStandard: pbIsStandard },
        user.uid,
        activeWorkspaceId,
        activeOrganizationId || 'default'
      );

      if (res.success) {
        toast({ title: 'Price Book Created', description: `Price Book "${pbName}" added.` });
        setPbName('');
        setPbDescription('');
        setIsPriceBookFormOpen(false);
        loadData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create price book.' });
    } finally {
      setIsSubmittingPriceBook(false);
    }
  };

  const filteredProducts = React.useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchQuery || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategoryFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl rounded-2xl p-0 overflow-hidden border bg-card shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Product Catalog & Price Books
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">
                  Manage standardized items, recurring billing intervals, tax rates, and rate cards.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleOpenNewProduct}
              className="min-h-[44px] sm:min-h-[38px] px-4 rounded-xl font-bold text-xs gap-2 bg-primary text-white shadow-md cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 border-b bg-card shrink-0">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'products' | 'categories' | 'price_books')}>
            <TabsList className="grid w-full max-w-md grid-cols-3 rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="products" className="rounded-lg text-xs font-bold gap-1.5 min-h-[36px]">
                <Package className="h-3.5 w-3.5" /> Products ({products.length})
              </TabsTrigger>
              <TabsTrigger value="categories" className="rounded-lg text-xs font-bold gap-1.5 min-h-[36px]">
                <Layers className="h-3.5 w-3.5" /> Categories ({categories.length})
              </TabsTrigger>
              <TabsTrigger value="price_books" className="rounded-lg text-xs font-bold gap-1.5 min-h-[36px]">
                <BookOpen className="h-3.5 w-3.5" /> Price Books ({priceBooks.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products or SKU..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl min-h-[44px] sm:min-h-[40px]"
                  />
                </div>

                {categories.length > 0 && (
                  <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[200px] rounded-xl min-h-[44px] sm:min-h-[40px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Products List Table */}
              {isLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Loading catalog...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/10 p-6">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {searchQuery ? 'No products match your search query.' : 'No products in catalog yet. Click "Add Product" above.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden bg-card divide-y">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{p.name}</span>
                          {p.sku && (
                            <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
                              {p.sku}
                            </Badge>
                          )}
                          {p.isRecurring ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-bold">
                              Recurring ({p.billingInterval})
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              One-Time
                            </Badge>
                          )}
                          {p.categoryName && (
                            <span className="text-[10px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                              {p.categoryName}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">
                            {formatCurrency(p.unitPrice, p.currency)}
                          </p>
                          {p.taxRate ? (
                            <p className="text-[10px] text-muted-foreground">+{p.taxRate}% Tax</p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditProduct(p)}
                            className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="h-9 w-9 p-0 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Group your products and line items into logical commercial categories.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCategoryFormOpen(true)}
                  className="rounded-xl font-bold text-xs gap-1.5 bg-primary text-white min-h-[38px]"
                >
                  <Plus className="h-3.5 w-3.5" /> New Category
                </Button>
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/10 p-6">
                  <p className="text-xs font-semibold text-muted-foreground">No categories created yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map(c => (
                    <div key={c.id} className="p-4 rounded-xl border bg-card space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color || '#4f46e5' }} />
                        <span className="text-sm font-bold text-foreground">{c.name}</span>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'price_books' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Define specialized pricing tiers, currency-specific rate cards, or partner price books.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsPriceBookFormOpen(true)}
                  className="rounded-xl font-bold text-xs gap-1.5 bg-primary text-white min-h-[38px]"
                >
                  <Plus className="h-3.5 w-3.5" /> New Price Book
                </Button>
              </div>

              {priceBooks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/10 p-6">
                  <p className="text-xs font-semibold text-muted-foreground">No custom price books created yet. The catalog uses Standard Pricing by default.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {priceBooks.map(pb => (
                    <div key={pb.id} className="p-4 rounded-xl border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{pb.name}</span>
                        {pb.isStandard ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">Standard</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold">{pb.currency}</Badge>
                        )}
                      </div>
                      {pb.description && <p className="text-xs text-muted-foreground">{pb.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-xs min-h-[44px] px-6"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Subdialog: Product Add/Edit Form */}
      <Dialog open={isProductFormOpen} onOpenChange={setIsProductFormOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden border bg-card shadow-2xl">
          <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
            <DialogTitle className="text-base font-bold text-foreground">
              {editingProduct ? 'Edit Product' : 'Create New Product / Service'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">
              Configure name, SKU, price, tax rate, and billing intervals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Product Name *</Label>
              <Input
                required
                value={prodName}
                onChange={e => setProdName(e.target.value)}
                placeholder="e.g. Enterprise License (Per Student)"
                className="rounded-xl min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">SKU / Code</Label>
                <Input
                  value={prodSku}
                  onChange={e => setProdSku(e.target.value)}
                  placeholder="e.g. LIC-EDU-01"
                  className="rounded-xl min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Category</Label>
                <Select value={prodCategoryId} onValueChange={setProdCategoryId}>
                  <SelectTrigger className="rounded-xl min-h-[44px]">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">No Category</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Unit Price *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={prodUnitPrice}
                  onChange={e => setProdUnitPrice(e.target.value)}
                  className="rounded-xl min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Currency</Label>
                <Select value={prodCurrency} onValueChange={setProdCurrency}>
                  <SelectTrigger className="rounded-xl min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Tax Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={prodTaxRate}
                  onChange={e => setProdTaxRate(e.target.value)}
                  className="rounded-xl min-h-[44px]"
                />
              </div>
            </div>

            {/* Recurring Billing Toggle */}
            <div className="p-4 rounded-xl bg-muted/20 border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Recurring Revenue Product</p>
                  <p className="text-[10px] text-muted-foreground">Enable if this item generates MRR/ARR subscription revenue.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProdIsRecurring(!prodIsRecurring)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    prodIsRecurring ? 'bg-primary justify-end' : 'bg-muted-foreground/30 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              {prodIsRecurring && (
                <div className="pt-2 border-t space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Billing Frequency</Label>
                  <Select 
                    value={prodBillingInterval} 
                    onValueChange={v => setProdBillingInterval(v as 'monthly' | 'quarterly' | 'annual')}
                  >
                    <SelectTrigger className="rounded-xl min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="monthly">Monthly (1x MRR)</SelectItem>
                      <SelectItem value="quarterly">Quarterly (1/3 MRR)</SelectItem>
                      <SelectItem value="annual">Annual (1/12 MRR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Description</Label>
              <textarea
                value={prodDescription}
                onChange={e => setProdDescription(e.target.value)}
                placeholder="Product details, scope, deliverables..."
                className="w-full min-h-[70px] rounded-xl p-3 text-xs bg-muted/10 border outline-none resize-none"
              />
            </div>

            <DialogFooter className="pt-4 border-t flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsProductFormOpen(false)}
                disabled={isSubmittingProduct}
                className="rounded-xl font-bold min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingProduct || !prodName.trim()}
                className="rounded-xl font-bold min-h-[44px] px-8 bg-primary text-white gap-2 shadow-md"
              >
                {isSubmittingProduct ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Save Product</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subdialog: Category Form */}
      <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-card border shadow-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">New Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Category Name *</Label>
              <Input
                required
                value={catName}
                onChange={e => setCatName(e.target.value)}
                placeholder="e.g. Software Licenses, Hardware, Services"
                className="rounded-xl min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Badge Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={catColor}
                  onChange={e => setCatColor(e.target.value)}
                  className="h-10 w-12 rounded-lg cursor-pointer border p-1"
                />
                <Input value={catColor} onChange={e => setCatColor(e.target.value)} className="rounded-xl font-mono text-xs min-h-[44px]" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={isSubmittingCategory || !catName.trim()} className="rounded-xl font-bold min-h-[44px] bg-primary text-white w-full">
                {isSubmittingCategory ? 'Creating...' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subdialog: Price Book Form */}
      <Dialog open={isPriceBookFormOpen} onOpenChange={setIsPriceBookFormOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-card border shadow-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">New Price Book</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePriceBook} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Price Book Name *</Label>
              <Input
                required
                value={pbName}
                onChange={e => setPbName(e.target.value)}
                placeholder="e.g. Enterprise Tier 2026, West Africa Rate Card"
                className="rounded-xl min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Currency</Label>
              <Select value={pbCurrency} onValueChange={setPbCurrency}>
                <SelectTrigger className="rounded-xl min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="NGN">NGN (₦)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={isSubmittingPriceBook || !pbName.trim()} className="rounded-xl font-bold min-h-[44px] bg-primary text-white w-full">
                {isSubmittingPriceBook ? 'Creating...' : 'Create Price Book'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
