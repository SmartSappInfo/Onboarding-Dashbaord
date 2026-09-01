'use client';

/**
 * @fileoverview Commercial & Pricing Hub - Finance Backoffice Console
 *
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Unified Commercial Hub - Rule 10):
 * - Canonical source of truth for all business offerings, pricing tiers, price books, and product taxonomies.
 * - Consolidates Products, Subscription Packages, Price Books, Categories, and AI Commercial Analytics into a 5-tab console.
 * - Preserves 100% backward compatibility with `subscription_packages` collection for entity billing.
 * - Strict typing with zero 'any' or 'any[]'.
 * - Mobile-first ergonomics with touch targets >= 44px and responsive layouts.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Product price changes do not retroactively alter closed/historical deals.
 * - Always enforce workspaceId boundaries on creation and deletion.
 * - Actionable toasts must supply relative paths starting with '/'.
 *
 * TESTABILITY POINTER:
 * Verify tab toggling, item creation (Products, Packages, Price Books, Categories), and live calculation in Analytics tab.
 */

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { 
  SubscriptionPackage, 
  Product, 
  ProductCategory, 
  PriceBook, 
  Deal 
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Wallet, 
  Layout, 
  Search,
  BookOpen,
  Tag,
  TrendingUp,
  DollarSign,
  Repeat,
  Percent,
  Check,
  X,
  Filter,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useTerminology } from '@/hooks/use-terminology';
import { formatCurrency } from '@/lib/currency-utils';
import { 
  listProductsAction, 
  createProductAction, 
  updateProductAction, 
  deleteProductAction,
  listProductCategoriesAction,
  createProductCategoryAction,
  updateProductCategoryAction,
  deleteProductCategoryAction,
  listPriceBooksAction,
  createPriceBookAction,
  updatePriceBookAction,
  deletePriceBookAction
} from '@/app/actions/product-actions';
import { calculateCommercialAnalytics } from '@/lib/deals/deal-commercial-analytics';
import CatalogAnalyticsTab from './components/CatalogAnalyticsTab';

export default function PackagesClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { singular } = useTerminology();
  const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();

  // Active Hub Tab
  const [activeTab, setActiveTab] = React.useState<'products' | 'packages' | 'price_books' | 'categories' | 'analytics'>('products');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('all');

  // Products Data State
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [priceBooks, setPriceBooks] = React.useState<PriceBook[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = React.useState(true);

  // Sub-modal states
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [isSavingProduct, setIsSavingProduct] = React.useState(false);

  // Product Form State
  const [prodName, setProdName] = React.useState('');
  const [prodSku, setProdSku] = React.useState('');
  const [prodDescription, setProdDescription] = React.useState('');
  const [prodCategoryId, setProdCategoryId] = React.useState('none');
  const [prodUnitPrice, setProdUnitPrice] = React.useState('0');
  const [prodCurrency, setProdCurrency] = React.useState('USD');
  const [prodIsRecurring, setProdIsRecurring] = React.useState(false);
  const [prodBillingInterval, setProdBillingInterval] = React.useState<'one_time' | 'monthly' | 'quarterly' | 'annual'>('monthly');
  const [prodTaxRate, setProdTaxRate] = React.useState('0');

  // Subscription Package Modal State
  const [isPackageModalOpen, setIsPackageModalOpen] = React.useState(false);
  const [editingPackage, setEditingPackage] = React.useState<SubscriptionPackage | null>(null);
  const [isSavingPackage, setIsSavingPackage] = React.useState(false);
  const [packageWorkspaceIds, setPackageWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);

  // Price Book Modal State
  const [isPriceBookModalOpen, setIsPriceBookModalOpen] = React.useState(false);
  const [editingPriceBook, setEditingPriceBook] = React.useState<PriceBook | null>(null);
  const [pbName, setPbName] = React.useState('');
  const [pbDescription, setPbDescription] = React.useState('');
  const [pbCurrency, setPbCurrency] = React.useState('USD');
  const [pbIsStandard, setPbIsStandard] = React.useState(false);
  const [isSavingPriceBook, setIsSavingPriceBook] = React.useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<ProductCategory | null>(null);
  const [catName, setCatName] = React.useState('');
  const [catDescription, setCatDescription] = React.useState('');
  const [catColor, setCatColor] = React.useState('#4f46e5');
  const [isSavingCategory, setIsSavingCategory] = React.useState(false);

  const workspaceOptions = allowedWorkspaces.map((w) => ({ label: w.name, value: w.id }));

  // 1. Subscription Packages Live Firestore Listener
  const packagesQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
      collection(firestore, 'subscription_packages'), 
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    ) : null, 
  [firestore, activeWorkspaceId]);
  
  const { data: rawPackages, isLoading: isLoadingPackages } = useCollection<SubscriptionPackage>(packagesQuery);
  const packages = React.useMemo(() => rawPackages || [], [rawPackages]);

  // 2. Deals Live Listener for Commercial Analytics
  const dealsQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId ? query(
      collection(firestore, 'deals'),
      where('workspaceId', '==', activeWorkspaceId),
      where('isArchived', '==', false)
    ) : null,
  [firestore, activeWorkspaceId]);

  const { data: rawDeals } = useCollection<Deal>(dealsQuery);
  const deals = React.useMemo(() => rawDeals || [], [rawDeals]);

  // Load Catalog Data (Products, Categories, Price Books)
  const loadCatalogData = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoadingCatalog(true);
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
      console.error('[Commercial Hub] Failed to load catalog data:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadCatalogData();
  }, [loadCatalogData]);

  // Compute Commercial Analytics
  const commercialAnalytics = React.useMemo(() => {
    return calculateCommercialAnalytics(deals, products, packages, categories, priceBooks);
  }, [deals, products, packages, categories, priceBooks]);

  // ----------------------------------------------------
  // PRODUCT HANDLERS
  // ----------------------------------------------------
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdDescription('');
    setProdCategoryId('none');
    setProdUnitPrice('0');
    setProdCurrency('USD');
    setProdIsRecurring(false);
    setProdBillingInterval('one_time');
    setProdTaxRate('0');
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdSku(prod.sku || '');
    setProdDescription(prod.description || '');
    setProdCategoryId(prod.categoryId || 'none');
    setProdUnitPrice(String(prod.unitPrice || 0));
    setProdCurrency(prod.currency || 'USD');
    setProdIsRecurring(Boolean(prod.isRecurring));
    setProdBillingInterval(prod.billingInterval || 'one_time');
    setProdTaxRate(String(prod.taxRate || 0));
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      toast({ title: 'Validation Error', description: 'Product name is required.', variant: 'destructive' });
      return;
    }

    setIsSavingProduct(true);
    const parsedPrice = parseFloat(prodUnitPrice) || 0;
    const parsedTax = parseFloat(prodTaxRate) || 0;
    const selectedCat = categories.find(c => c.id === prodCategoryId);

    try {
      if (editingProduct) {
        const res = await updateProductAction(
          editingProduct.id,
          {
            name: prodName.trim(),
            sku: prodSku.trim() || undefined,
            description: prodDescription.trim() || undefined,
            categoryId: prodCategoryId !== 'none' ? prodCategoryId : undefined,
            categoryName: selectedCat?.name,
            unitPrice: parsedPrice,
            currency: prodCurrency,
            isRecurring: prodIsRecurring,
            billingInterval: prodIsRecurring ? prodBillingInterval : 'one_time',
            taxRate: parsedTax,
          },
          user?.uid || 'system',
          activeWorkspaceId
        );

        if (res.success) {
          toast({ 
            title: 'Product Updated', 
            description: `"${prodName.trim()}" has been updated.`,
            actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
          });
          setIsProductModalOpen(false);
          loadCatalogData();
        } else {
          toast({ title: 'Update Failed', description: res.error, variant: 'destructive' });
        }
      } else {
        const res = await createProductAction({
          name: prodName.trim(),
          sku: prodSku.trim() || undefined,
          description: prodDescription.trim() || undefined,
          categoryId: prodCategoryId !== 'none' ? prodCategoryId : undefined,
          categoryName: selectedCat?.name,
          unitPrice: parsedPrice,
          currency: prodCurrency,
          isRecurring: prodIsRecurring,
          billingInterval: prodIsRecurring ? prodBillingInterval : 'one_time',
          taxRate: parsedTax,
        }, user?.uid || 'system', activeWorkspaceId);

        if (res.success) {
          toast({ 
            title: 'Product Created', 
            description: `"${prodName.trim()}" is now in your commercial catalog.`,
            actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
          });
          setIsProductModalOpen(false);
          loadCatalogData();
        } else {
          toast({ title: 'Creation Failed', description: res.error, variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save product.', variant: 'destructive' });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    const isConfirmed = await confirm({
      title: 'Delete Product',
      description: `Are you sure you want to delete "${prod.name}"? Historical deal line items will preserve their snapshot copy.`,
      confirmText: 'Delete Product',
      variant: 'destructive',
    });

    if (!isConfirmed) return;

    const res = await deleteProductAction(prod.id, user?.uid || 'system', activeWorkspaceId);
    if (res.success) {
      toast({ 
        title: 'Product Removed', 
        description: `"${prod.name}" was removed from the catalog.`,
        actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
      });
      loadCatalogData();
    } else {
      toast({ title: 'Delete Failed', description: res.error, variant: 'destructive' });
    }
  };

  // ----------------------------------------------------
  // SUBSCRIPTION PACKAGE HANDLERS
  // ----------------------------------------------------
  const handleSavePackage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || packageWorkspaceIds.length === 0) {
      toast({ variant: 'destructive', title: 'Workspace Required' });
      return;
    }
    
    setIsSavingPackage(true);
    const formData = new FormData(e.currentTarget);
    
    const packageData = {
      name: String(formData.get('name') || ''),
      description: String(formData.get('description') || ''),
      ratePerStudent: Number(formData.get('rate')) || 0,
      billingTerm: (String(formData.get('term') || 'termly')) as SubscriptionPackage['billingTerm'],
      currency: String(formData.get('currency') || 'USD'),
      isActive: formData.get('isActive') === 'on',
      workspaceIds: packageWorkspaceIds,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingPackage) {
        await updateDoc(doc(firestore, 'subscription_packages', editingPackage.id), packageData);
        toast({ 
          title: 'Package Updated',
          actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
        });
      } else {
        await addDoc(collection(firestore, 'subscription_packages'), {
          ...packageData,
          createdAt: new Date().toISOString()
        });
        toast({ 
          title: 'Package Created',
          actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
        });
      }
      setIsPackageModalOpen(false);
      setEditingPackage(null);
      setPackageWorkspaceIds([activeWorkspaceId]);
    } catch {
      toast({ variant: 'destructive', title: 'Operation Failed' });
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!firestore) return;
    if (!(await confirm({ 
      title: 'Delete pricing tier?', 
      description: 'Records using this package will require manual reassignment.', 
      confirmText: 'Delete', 
      variant: 'destructive' 
    }))) return;

    try {
      await deleteDoc(doc(firestore, 'subscription_packages', id));
      toast({ 
        title: 'Package Removed',
        actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
      });
    } catch {
      toast({ variant: 'destructive', title: 'Deletion Failed' });
    }
  };

  // ----------------------------------------------------
  // PRICE BOOK & CATEGORY HANDLERS
  // ----------------------------------------------------
  const handleOpenNewPriceBook = () => {
    setEditingPriceBook(null);
    setPbName('');
    setPbDescription('');
    setPbCurrency('USD');
    setPbIsStandard(false);
    setIsPriceBookModalOpen(true);
  };

  const handleEditPriceBook = (pb: PriceBook) => {
    setEditingPriceBook(pb);
    setPbName(pb.name);
    setPbDescription(pb.description || '');
    setPbCurrency(pb.currency || 'USD');
    setPbIsStandard(Boolean(pb.isStandard));
    setIsPriceBookModalOpen(true);
  };

  const handleSavePriceBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pbName.trim()) return;

    setIsSavingPriceBook(true);
    try {
      if (editingPriceBook) {
        const res = await updatePriceBookAction(
          editingPriceBook.id,
          {
            name: pbName.trim(),
            description: pbDescription.trim() || undefined,
            currency: pbCurrency,
            isStandard: pbIsStandard,
          },
          user?.uid || 'system',
          activeWorkspaceId
        );

        if (res.success) {
          toast({ 
            title: 'Price Book Updated',
            actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
          });
          setIsPriceBookModalOpen(false);
          setEditingPriceBook(null);
          loadCatalogData();
        } else {
          toast({ title: 'Update Failed', description: res.error, variant: 'destructive' });
        }
      } else {
        const res = await createPriceBookAction({
          name: pbName.trim(),
          description: pbDescription.trim() || undefined,
          currency: pbCurrency,
          isStandard: pbIsStandard,
        }, user?.uid || 'system', activeWorkspaceId);

        if (res.success) {
          toast({ 
            title: 'Price Book Created',
            actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
          });
          setIsPriceBookModalOpen(false);
          setPbName('');
          setPbDescription('');
          loadCatalogData();
        } else {
          toast({ title: 'Creation Failed', description: res.error, variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save price book.', variant: 'destructive' });
    } finally {
      setIsSavingPriceBook(false);
    }
  };

  const handleDeletePriceBook = async (pb: PriceBook) => {
    const isConfirmed = await confirm({
      title: 'Delete Price Book',
      description: `Are you sure you want to delete "${pb.name}"?`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!isConfirmed) return;

    const res = await deletePriceBookAction(pb.id, user?.uid || 'system', activeWorkspaceId);
    if (res.success) {
      toast({ title: 'Price Book Removed' });
      loadCatalogData();
    }
  };

  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatDescription('');
    setCatColor('#4f46e5');
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDescription(cat.description || '');
    setCatColor(cat.color || '#4f46e5');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        const res = await updateProductCategoryAction(
          editingCategory.id,
          {
            name: catName.trim(),
            description: catDescription.trim() || undefined,
            color: catColor,
          },
          user?.uid || 'system',
          activeWorkspaceId
        );

        if (res.success) {
          toast({ 
            title: 'Category Updated',
            actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
          });
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
          loadCatalogData();
        } else {
          toast({ title: 'Update Failed', description: res.error, variant: 'destructive' });
        }
      } else {
        const res = await createProductCategoryAction({
          name: catName.trim(),
          description: catDescription.trim() || undefined,
          color: catColor,
        }, user?.uid || 'system', activeWorkspaceId);

        if (res.success) {
          toast({ 
            title: 'Category Created',
            actionConfig: { path: '/admin/finance/packages', label: 'Pricing Hub' }
          });
          setIsCategoryModalOpen(false);
          setCatName('');
          setCatDescription('');
          loadCatalogData();
        } else {
          toast({ title: 'Creation Failed', description: res.error, variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save category.', variant: 'destructive' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: ProductCategory) => {
    const isConfirmed = await confirm({
      title: 'Delete Category',
      description: `Are you sure you want to delete "${cat.name}"? Products in this category will be unassigned.`,
      confirmText: 'Delete Category',
      variant: 'destructive',
    });
    if (!isConfirmed) return;

    const res = await deleteProductCategoryAction(cat.id, user?.uid || 'system', activeWorkspaceId);
    if (res.success) {
      toast({ title: 'Category Removed' });
      loadCatalogData();
    }
  };

  // Filtered lists
  const filteredProducts = React.useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategoryFilter]);

  const filteredPackages = React.useMemo(() => {
    if (!searchTerm) return packages;
    const s = searchTerm.toLowerCase();
    return packages.filter((p) => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
  }, [packages, searchTerm]);

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-32 w-full text-left">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-card to-background border border-primary/20 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg">
                Finance & Sales Command
              </Badge>
              <span className="text-xs font-bold text-muted-foreground">• {products.length} Products & {packages.length} Subscription Tiers</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Package className="h-7 w-7 text-primary" />
              Commercial & Pricing Hub
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Centralized commercial catalog for standard products, recurring software subscriptions, institutional pricing tiers, price books, and margin analytics.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeTab === 'products' && (
              <Button 
                onClick={handleOpenNewProduct} 
                className="rounded-xl font-bold shadow-md shadow-primary/20 h-11 min-h-[44px] px-5 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90 text-xs flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> New Product
              </Button>
            )}
            {activeTab === 'packages' && (
              <Button 
                onClick={() => { setIsPackageModalOpen(true); setEditingPackage(null); setPackageWorkspaceIds([activeWorkspaceId]); }} 
                className="rounded-xl font-bold shadow-md shadow-primary/20 h-11 min-h-[44px] px-5 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90 text-xs flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> New Package Tier
              </Button>
            )}
            {activeTab === 'price_books' && (
              <Button 
                onClick={handleOpenNewPriceBook} 
                className="rounded-xl font-bold shadow-md shadow-primary/20 h-11 min-h-[44px] px-5 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90 text-xs flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> New Price Book
              </Button>
            )}
            {activeTab === 'categories' && (
              <Button 
                onClick={handleOpenNewCategory} 
                className="rounded-xl font-bold shadow-md shadow-primary/20 h-11 min-h-[44px] px-5 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90 text-xs flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> New Category
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="space-y-6">
          <TabsList className="bg-muted/40 p-1.5 rounded-2xl border border-border/50 h-auto flex flex-wrap gap-1">
            <TabsTrigger 
              value="products" 
              className="rounded-xl font-bold text-xs px-4 py-2.5 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary gap-2"
            >
              <Package className="h-3.5 w-3.5" />
              Products & Services ({products.length})
            </TabsTrigger>
            <TabsTrigger 
              value="packages" 
              className="rounded-xl font-bold text-xs px-4 py-2.5 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary gap-2"
            >
              <Wallet className="h-3.5 w-3.5" />
              Subscription Tiers ({packages.length})
            </TabsTrigger>
            <TabsTrigger 
              value="price_books" 
              className="rounded-xl font-bold text-xs px-4 py-2.5 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary gap-2"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Price Books ({priceBooks.length})
            </TabsTrigger>
            <TabsTrigger 
              value="categories" 
              className="rounded-xl font-bold text-xs px-4 py-2.5 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary gap-2"
            >
              <Tag className="h-3.5 w-3.5" />
              Categories ({categories.length})
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="rounded-xl font-bold text-xs px-4 py-2.5 min-h-[40px] data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary gap-2"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Commercial Analytics & AI
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PRODUCTS & SERVICES */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                <Input 
                  placeholder="Search products by name or SKU..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 bg-card border-border/80 text-foreground placeholder:text-muted-foreground rounded-xl text-xs font-medium"
                />
              </div>

              {categories.length > 0 && (
                <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                  <SelectTrigger className="w-48 h-10 rounded-xl text-xs font-semibold bg-card border-border/80">
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

            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Product / SKU</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Category</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Billing Type</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Unit Price</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCatalog ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6 py-5"><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredProducts.length ? (
                    filteredProducts.map((prod) => (
                      <TableRow key={prod.id} className="group hover:bg-muted/25 transition-colors">
                        <TableCell className="pl-6 py-3.5">
                          <div>
                            <p className="font-bold text-xs text-foreground tracking-tight">{prod.name}</p>
                            {prod.sku && <p className="text-[10px] font-mono text-muted-foreground">{prod.sku}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {prod.categoryName || 'Unassigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {prod.isRecurring ? (
                            <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold px-2 py-0.5">
                              Recurring ({prod.billingInterval})
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] font-bold px-2 py-0.5 opacity-80">
                              One-Time
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">
                          {formatCurrency(prod.unitPrice, prod.currency || 'USD')}
                        </TableCell>
                        <TableCell className="text-center">
                          {prod.isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] h-5 uppercase px-2 font-bold">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-bold opacity-40">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                              onClick={() => handleEditProduct(prod)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                              onClick={() => handleDeleteProduct(prod)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-44 text-center text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No products found in catalog.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 2: SUBSCRIPTION PACKAGES */}
          <TabsContent value="packages" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
              <Input 
                placeholder="Search subscription packages..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 bg-card border-border/80 text-foreground placeholder:text-muted-foreground rounded-xl text-xs font-medium"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Package Name</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Rate (Per {singular})</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Visibility</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPackages ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6 py-5"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredPackages.length ? (
                    filteredPackages.map((pkg) => (
                      <TableRow key={pkg.id} className="group hover:bg-muted/25 transition-colors">
                        <TableCell className="pl-6 py-3.5">
                          <div>
                            <p className="font-bold text-xs text-foreground tracking-tight">{pkg.name}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold">{pkg.billingTerm} cycle</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-black text-xs">
                            <span className="text-[10px] opacity-40">{pkg.currency}</span>
                            {pkg.ratePerStudent.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {pkg.workspaceIds?.map((wId) => (
                              <Badge key={wId} variant="outline" className="text-[8px] font-bold uppercase h-4 border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                            )) || <Badge variant="secondary" className="text-[8px] font-bold opacity-30">Unbound</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {pkg.isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] h-5 uppercase px-2 font-bold">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-bold opacity-40">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                              onClick={() => { setEditingPackage(pkg); setPackageWorkspaceIds(pkg.workspaceIds || [activeWorkspaceId]); setIsPackageModalOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                              onClick={() => handleDeletePackage(pkg.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-44 text-center text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No subscription packages found.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 3: PRICE BOOKS */}
          <TabsContent value="price_books" className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Price Book Name</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Currency</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Type</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCatalog ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6 py-5"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : priceBooks.length ? (
                    priceBooks.map((pb) => (
                      <TableRow key={pb.id} className="group hover:bg-muted/25 transition-colors">
                        <TableCell className="pl-6 py-3.5">
                          <div>
                            <p className="font-bold text-xs text-foreground tracking-tight">{pb.name}</p>
                            {pb.description && <p className="text-[10px] text-muted-foreground">{pb.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold">{pb.currency}</TableCell>
                        <TableCell className="text-center">
                          {pb.isStandard ? (
                            <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold">Standard Baseline</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] font-bold">Custom Rate Sheet</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {pb.isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] h-5 uppercase px-2 font-bold">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-bold opacity-40">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                              onClick={() => handleEditPriceBook(pb)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                              onClick={() => handleDeletePriceBook(pb)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-44 text-center text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No price books configured.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 4: CATEGORIES */}
          <TabsContent value="categories" className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Category Name</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider">Description</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCatalog ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6 py-5"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : categories.length ? (
                    categories.map((cat) => (
                      <TableRow key={cat.id} className="group hover:bg-muted/25 transition-colors">
                        <TableCell className="pl-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#4f46e5' }} />
                            <span className="font-bold text-xs text-foreground tracking-tight">{cat.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cat.description || 'No description provided.'}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                              onClick={() => handleEditCategory(cat)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                              onClick={() => handleDeleteCategory(cat)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-44 text-center text-muted-foreground">
                        <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No product categories created.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 5: COMMERCIAL ANALYTICS & AI */}
          <TabsContent value="analytics" className="space-y-4">
            <CatalogAnalyticsTab 
              summary={commercialAnalytics} 
              currency="USD"
              isLoading={isLoadingCatalog}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ----------------------------------------------------
          MODAL 1: PRODUCT CREATE / EDIT
      ------------------------------------------------------ */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-card border-border shadow-2xl space-y-4 text-left">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {editingProduct ? 'Edit Catalog Product' : 'Add New Product or Service'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define product SKU, billing interval, unit price, and taxonomy.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-xs font-bold">Product Name *</Label>
                <Input 
                  value={prodName} 
                  onChange={e => setProdName(e.target.value)} 
                  placeholder="e.g. Pro SaaS License" 
                  className="h-10 rounded-xl text-xs" 
                  required 
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-xs font-bold">SKU Code</Label>
                <Input 
                  value={prodSku} 
                  onChange={e => setProdSku(e.target.value)} 
                  placeholder="e.g. SKU-PRO-01" 
                  className="h-10 rounded-xl text-xs font-mono" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Category</Label>
                <Select value={prodCategoryId} onValueChange={setProdCategoryId}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">Unassigned</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Currency</Label>
                <Select value={prodCurrency} onValueChange={setProdCurrency}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Unit Price</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={prodUnitPrice} 
                  onChange={e => setProdUnitPrice(e.target.value)} 
                  className="h-10 rounded-xl text-xs font-bold" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tax Rate (%)</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="100" 
                  value={prodTaxRate} 
                  onChange={e => setProdTaxRate(e.target.value)} 
                  className="h-10 rounded-xl text-xs" 
                />
              </div>
            </div>

            {/* Recurring Billing Controls */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground">Recurring Subscription</Label>
                  <p className="text-[11px] text-muted-foreground">Charge on a repeating schedule (MRR/ARR)</p>
                </div>
                <Switch checked={prodIsRecurring} onCheckedChange={setProdIsRecurring} />
              </div>

              {prodIsRecurring && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold">Billing Interval</Label>
                  <Select 
                    value={prodBillingInterval} 
                    onValueChange={(val) => setProdBillingInterval(val as typeof prodBillingInterval)}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="monthly">Monthly Recurring</SelectItem>
                      <SelectItem value="quarterly">Quarterly Recurring</SelectItem>
                      <SelectItem value="annual">Annual Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Description</Label>
              <Textarea 
                value={prodDescription} 
                onChange={e => setProdDescription(e.target.value)} 
                placeholder="Product details, inclusion list, or scope..." 
                className="h-20 rounded-xl text-xs" 
              />
            </div>

            <DialogFooter className="pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsProductModalOpen(false)}
                className="h-10 min-h-[44px] rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSavingProduct}
                className="h-10 min-h-[44px] rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
              >
                {isSavingProduct && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingProduct ? 'Update Product' : 'Save Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------
          MODAL 2: SUBSCRIPTION PACKAGE CREATE / EDIT
      ------------------------------------------------------ */}
      <Dialog open={isPackageModalOpen} onOpenChange={setIsPackageModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card text-left">
          <form onSubmit={handleSavePackage}>
            <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
              <div className="flex items-center gap-3 text-left">
                <div className="p-2.5 bg-primary text-white rounded-xl shadow-md shadow-primary/20 text-left">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-xl font-bold tracking-tight text-left">
                    {editingPackage ? 'Sync Pricing Tier' : 'Initialize Pricing Tier'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground text-left">
                    Define unit-based subscription logic
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-5 text-left bg-background">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-primary ml-1 flex items-center gap-1.5">
                  <Layout className="h-3.5 w-3.5" /> Shared Workspace Visibility
                </Label>
                <MultiSelect 
                  options={workspaceOptions}
                  value={packageWorkspaceIds}
                  onChange={setPackageWorkspaceIds}
                  placeholder="Map to workspaces..."
                />
              </div>

              <Separator className="opacity-40" />

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Package Name</Label>
                <Input 
                  name="name" 
                  defaultValue={editingPackage?.name} 
                  placeholder="e.g. Standard Tier" 
                  className="h-10 rounded-xl bg-background border-border text-xs font-semibold" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground ml-1">Rate (Per {singular})</Label>
                  <Input 
                    name="rate" 
                    type="number" 
                    step="0.01" 
                    min="0"
                    defaultValue={editingPackage?.ratePerStudent ?? 0} 
                    placeholder="0.00" 
                    className="h-10 rounded-xl bg-background border-border text-xs font-bold" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground ml-1">Currency</Label>
                  <Select name="currency" defaultValue={editingPackage?.currency || 'USD'}>
                    <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Billing Cycle</Label>
                <Select name="term" defaultValue={editingPackage?.billingTerm || 'termly'}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs">
                    <SelectValue placeholder="Select billing term" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="monthly">Monthly Cycle</SelectItem>
                    <SelectItem value="termly">Termly Cycle</SelectItem>
                    <SelectItem value="semester">Semester Cycle</SelectItem>
                    <SelectItem value="annually">Annual Cycle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Description</Label>
                <Textarea 
                  name="description" 
                  defaultValue={editingPackage?.description} 
                  placeholder="Tier coverage details..." 
                  className="h-20 rounded-xl bg-background border-border text-xs resize-none" 
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20">
                <Label htmlFor="isActive" className="text-xs font-semibold cursor-pointer">Active State</Label>
                <Switch id="isActive" name="isActive" defaultChecked={editingPackage?.isActive ?? true} />
              </div>
            </div>

            <DialogFooter className="p-4 bg-muted/20 border-t flex justify-end gap-2 shrink-0">
              <Button 
                type="button" 
                variant="ghost" 
                className="h-10 min-h-[44px] rounded-xl text-xs font-bold" 
                onClick={() => setIsPackageModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSavingPackage} 
                className="h-10 min-h-[44px] px-6 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 active:scale-[0.97]"
              >
                {isSavingPackage && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {editingPackage ? 'Update Pricing Tier' : 'Deploy Pricing Tier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------
          MODAL 3: PRICE BOOK CREATE / EDIT
      ------------------------------------------------------ */}
      <Dialog open={isPriceBookModalOpen} onOpenChange={setIsPriceBookModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border-border shadow-2xl space-y-4 text-left">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {editingPriceBook ? 'Edit Price Book' : 'Create Price Book'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define custom rate cards for specific customer tiers or regions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePriceBook} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Price Book Name *</Label>
              <Input 
                value={pbName} 
                onChange={e => setPbName(e.target.value)} 
                placeholder="e.g. Enterprise Tier 2026" 
                className="h-10 rounded-xl text-xs" 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Currency</Label>
                <Select value={pbCurrency} onValueChange={setPbCurrency}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/50 h-10">
                  <Label className="text-xs font-semibold">Standard</Label>
                  <Switch checked={pbIsStandard} onCheckedChange={setPbIsStandard} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Description</Label>
              <Textarea 
                value={pbDescription} 
                onChange={e => setPbDescription(e.target.value)} 
                placeholder="Rate sheet terms and applicability..." 
                className="h-20 rounded-xl text-xs" 
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPriceBookModalOpen(false)} className="h-10 min-h-[44px] rounded-xl text-xs font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingPriceBook} className="h-10 min-h-[44px] rounded-xl text-xs font-bold bg-primary text-primary-foreground">
                {isSavingPriceBook && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPriceBook ? 'Update Price Book' : 'Create Price Book'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------
          MODAL 4: CATEGORY CREATE / EDIT
      ------------------------------------------------------ */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-card border-border shadow-2xl space-y-4 text-left">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              {editingCategory ? 'Edit Product Category' : 'Add Product Category'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Group products and packages for reporting and quoting.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Category Name *</Label>
              <Input 
                value={catName} 
                onChange={e => setCatName(e.target.value)} 
                placeholder="e.g. Hardware, SaaS, Consulting" 
                className="h-10 rounded-xl text-xs" 
                required 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Color Theme</Label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={catColor} 
                  onChange={e => setCatColor(e.target.value)} 
                  className="h-9 w-10 rounded-xl cursor-pointer bg-transparent border-0" 
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['#4f46e5', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0284c7', '#64748b'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={`h-6 w-6 rounded-full transition-all cursor-pointer ${
                        catColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Description</Label>
              <Textarea 
                value={catDescription} 
                onChange={e => setCatDescription(e.target.value)} 
                placeholder="Category scope..." 
                className="h-20 rounded-xl text-xs" 
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCategoryModalOpen(false)} className="h-10 min-h-[44px] rounded-xl text-xs font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCategory} className="h-10 min-h-[44px] rounded-xl text-xs font-bold bg-primary text-primary-foreground">
                {isSavingCategory && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCategory ? 'Update Category' : 'Save Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}
