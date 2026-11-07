'use client';

import * as React from 'react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import {
  Plus,
  Search,
  Filter,
  Package,
  MoreVertical,
  Edit,
  Trash2,
  DollarSign,
  Truck,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Calculator,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { cn, formatRelativeTime, formatCurrency, getBomStatusColor } from '@/lib/utils';
import type { HardwareBomItem, BomStatus, RoomMember, User, Room } from '@/types/database';

const BOM_STATUS_OPTIONS: { value: BomStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'planned', label: 'Planned', icon: <AlertCircle className="w-4 h-4" /> },
  { value: 'ordered', label: 'Ordered', icon: <Truck className="w-4 h-4" /> },
  { value: 'received', label: 'Received', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'installed', label: 'Installed', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'failed', label: 'Failed', icon: <XCircle className="w-4 h-4" /> },
];

interface BomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: (RoomMember & { user: User })[];
  roomId: string;
  onSubmit: (data: Partial<HardwareBomItem>) => void;
  editingItem?: HardwareBomItem | null;
}

function BomDialog({ open, onOpenChange, members, roomId, onSubmit, editingItem }: BomDialogProps) {
  const [formData, setFormData] = React.useState({
    component: '',
    quantity: 1,
    unit_est_cost: '',
    unit_actual_cost: '',
    buyer_id: '',
    status: 'planned' as BomStatus,
    supplier_url: '',
    notes: '',
  });

  React.useEffect(() => {
    if (editingItem) {
      setFormData({
        component: editingItem.component,
        quantity: editingItem.quantity,
        unit_est_cost: editingItem.unit_est_cost?.toString() || '',
        unit_actual_cost: editingItem.unit_actual_cost?.toString() || '',
        buyer_id: editingItem.buyer_id || '',
        status: editingItem.status,
        supplier_url: editingItem.supplier_url || '',
        notes: editingItem.notes || '',
      });
    } else {
      setFormData({
        component: '',
        quantity: 1,
        unit_est_cost: '',
        unit_actual_cost: '',
        buyer_id: '',
        status: 'planned' as BomStatus,
        supplier_url: '',
        notes: '',
      });
    }
  }, [editingItem, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, room_id: roomId, quantity: Number(formData.quantity), unit_est_cost: formData.unit_est_cost ? Number(formData.unit_est_cost) : null, unit_actual_cost: formData.unit_actual_cost ? Number(formData.unit_actual_cost) : null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit BOM Item' : 'Add BOM Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="component">Component *</Label>
            <Input
              id="component"
              value={formData.component}
              onChange={(e) => setFormData({ ...formData, component: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                onValueChange={(v: string) => setFormData({ ...formData, status: v as BomStatus })}
                defaultValue={formData.status}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOM_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Est. Unit Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_est_cost}
                onChange={(e) => setFormData({ ...formData, unit_est_cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual Unit Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.unit_actual_cost}
                onChange={(e) => setFormData({ ...formData, unit_actual_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Buyer</Label>
            <Select
              onValueChange={(v: string) => setFormData({ ...formData, buyer_id: v })}
              defaultValue={formData.buyer_id}
            >
              <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user.display_name || m.user.username || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Supplier URL</Label>
            <Input
              value={formData.supplier_url}
              onChange={(e) => setFormData({ ...formData, supplier_url: e.target.value })}
              placeholder="https://supplier.com/item"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editingItem ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoomBomClient({ room, initialBom, initialMembers }: {
  room: Room;
  initialBom: HardwareBomItem[];
  initialMembers: (RoomMember & { user: User })[];
}) {
  const { user } = useAuthStore();
  const [bom, setBom] = React.useState(initialBom);
  const [bomDialogOpen, setBomDialogOpen] = React.useState(false);
  const [editingBomItem, setEditingBomItem] = React.useState<HardwareBomItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<BomStatus | 'all'>('all');
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);

  const filteredBom = bom.filter(item => {
    if (searchQuery && !item.component.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  const totalEst = bom.reduce((sum, i) => sum + (i.total_est_cost || 0), 0);
  const totalActual = bom.reduce((sum, i) => sum + (i.total_actual_cost || 0), 0);
  const receivedCount = bom.filter(i => i.status === 'received' || i.status === 'installed').length;
  const failedCount = bom.filter(i => i.status === 'failed').length;

  const handleUpdateBom = async (data: Partial<HardwareBomItem>) => {
    const supabase = createClient();
    if (editingBomItem) {
      setBom(prev => prev.map(i => i.id === editingBomItem.id ? { ...i, ...data, updated_at: new Date().toISOString() } : i));
      try {
        await supabase.from('hardware_bom').update(data).eq('id', editingBomItem.id);
      } catch (error) {
        console.error('Failed to update BOM:', error);
      }
    } else {
      const newItem: HardwareBomItem = {
        id: crypto.randomUUID(),
        room_id: room.id,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_est_cost: (data.quantity || 0) * (data.unit_est_cost || 0),
        total_actual_cost: (data.quantity || 0) * (data.unit_actual_cost || 0),
      } as HardwareBomItem;
      setBom(prev => [newItem, ...prev]);
      try {
        await supabase.from('hardware_bom').insert(newItem);
      } catch (error) {
        console.error('Failed to create BOM item:', error);
      }
    }
  };

  const handleDeleteBom = async (id: string) => {
    if (!confirm('Delete this BOM item?')) return;
    setBom(prev => prev.filter(i => i.id !== id));
    try {
      const supabase = createClient();
      await supabase.from('hardware_bom').delete().eq('id', id);
    } catch (error) {
      console.error('Failed to delete BOM item:', error);
    }
  };

  const handleCalculateCosts = async () => {
    // TODO: Call NIM API to estimate costs
    setToast({ type: 'success', title: 'Cost Calculation', message: 'NIM cost estimation would run here' });
  };

  return (
    <ToastProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Bill of Materials</h1>
              <p className="text-sm text-muted-foreground">{room.name} • {bom.length} components</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCalculateCosts}>
                <Calculator className="w-4 h-4 mr-2" />
                Estimate Costs (NIM)
              </Button>
              <Dialog>
              <Button asChild>
                <DialogTrigger asChild>
                  <button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </DialogTrigger>
              </Button>
              <BomDialog
                open={bomDialogOpen}
                onOpenChange={setBomDialogOpen}
                members={initialMembers}
                roomId={room.id}
                onSubmit={handleUpdateBom}
                editingItem={editingBomItem}
              />
            </Dialog>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="border-b bg-white px-6 py-4 flex-shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Est. Cost</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalEst)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Actual Cost</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Received</p>
                    <p className="text-2xl font-bold">{receivedCount}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold">{failedCount}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b bg-white px-6 py-3 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select onValueChange={setFilterStatus} defaultValue={filterStatus} className="w-36">
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {BOM_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* BOM Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Component</th>
                  <th className="pb-2 pr-4">Qty</th>
                  <th className="pb-2 pr-4">Est. Unit</th>
                  <th className="pb-2 pr-4">Est. Total</th>
                  <th className="pb-2 pr-4">Actual Unit</th>
                  <th className="pb-2 pr-4">Actual Total</th>
                  <th className="pb-2 pr-4">Buyer</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBom.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No BOM items yet. Click "Add Item" to start tracking components.
                    </td>
                  </tr>
                ) : (
                  filteredBom.map(item => {
                    const statusOpt = BOM_STATUS_OPTIONS.find(s => s.value === item.status);
                    const buyer = item.buyer_id && initialMembers.find(m => m.user_id === item.buyer_id);
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 pr-4 font-medium">{item.component}</td>
                        <td className="py-3 pr-4">{item.quantity}</td>
                        <td className="py-3 pr-4">{item.unit_est_cost ? formatCurrency(item.unit_est_cost) : '—'}</td>
                        <td className="py-3 pr-4 font-medium">{item.total_est_cost ? formatCurrency(item.total_est_cost) : '—'}</td>
                        <td className="py-3 pr-4">{item.unit_actual_cost ? formatCurrency(item.unit_actual_cost) : '—'}</td>
                        <td className="py-3 pr-4 font-medium">{item.total_actual_cost ? formatCurrency(item.total_actual_cost) : '—'}</td>
                        <td className="py-3 pr-4">{buyer ? <span className="flex items-center gap-1"><Avatar className="h-5 w-5" src={buyer.user.avatar_url} fallback={buyer.user.display_name || buyer.user.username || undefined} />{buyer.user.display_name || buyer.user.username}</span> : '—'}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="role" role={getBomStatusColor(item.status).replace('bg-', '').replace(' text-', '')}>
                            {statusOpt?.icon}
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted"><MoreVertical className="w-4 h-4" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingBomItem(item)}>Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteBom(item.id)} className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ToastViewport />
      </div>

      {toast && (
        <Toast>
          <ToastTitle>{toast.title}</ToastTitle>
          <ToastDescription>{toast.message}</ToastDescription>
        </Toast>
      )}
    </ToastProvider>
  );
}
