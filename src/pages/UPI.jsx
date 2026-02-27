import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatCard from '../components/dashboard/StatCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Coins, TrendingUp, Users, ShoppingBag, ArrowDownUp, CheckCircle2, BarChart2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, startOfYear, isWithinInterval } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function UPI({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [showAutoBuyDialog, setShowAutoBuyDialog] = useState(false);
  const [autoBuyThreshold, setAutoBuyThreshold] = useState('');
  const [sellForm, setSellForm] = useState({ quantity: '', price_per_upi: '' });
  const [txPeriod, setTxPeriod] = useState('all');
  const qc = useQueryClient();
  const userRoles = currentUser?.role ? currentUser.role.split(',').map(r => r.trim()) : [];
  const isDriver = userRoles.includes('driver') && !userRoles.includes('admin');
  const isAdmin = userRoles.includes('admin');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['upi-transactions'],
    queryFn: () => base44.entities.UPITransaction.list('-created_date', 200),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['upi-orders'],
    queryFn: () => base44.entities.UPIOrder.list('-created_date'),
  });

  const myDriverRecord = isDriver ? drivers.find(d => d.email === currentUser?.email) : null;
  const myBalance = myDriverRecord?.upi_balance || 0;

  const myTransactions = isDriver
    ? transactions.filter(t => myDriverRecord && t.driver_id === myDriverRecord.id)
    : transactions;

  // Open orders sorted by price
  const openOrders = orders.filter(o => o.status === 'open').sort((a, b) => a.price_per_upi - b.price_per_upi);
  const bestAsk = openOrders.length > 0 ? openOrders[0].price_per_upi : null;

  // UPI price history chart (group by month using filled orders)
  const priceChartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM yy');
      const monthStart = startOfMonth(d).toISOString().split('T')[0];
      const monthEnd = endOfMonth(d).toISOString().split('T')[0];
      const filledInMonth = orders.filter(o => o.status === 'filled' && o.filled_at >= monthStart && o.filled_at <= monthEnd);
      const avgPrice = filledInMonth.length > 0
        ? filledInMonth.reduce((s, o) => s + o.price_per_upi, 0) / filledInMonth.length
        : null;
      months.push({ label, price: avgPrice });
    }
    return months;
  }, [orders]);

  // Period filter for driver transactions
  const filteredMyTx = useMemo(() => {
    const base = isDriver ? transactions.filter(t => myDriverRecord && t.driver_id === myDriverRecord.id) : transactions;
    if (txPeriod === 'all') return base;
    const now = new Date();
    return base.filter(t => {
      const d = new Date(t.created_date);
      if (txPeriod === 'week') return d >= startOfWeek(now, { weekStartsOn: 1 });
      if (txPeriod === 'month') return d >= startOfMonth(now);
      if (txPeriod === 'year') return d >= startOfYear(now);
      return true;
    });
  }, [transactions, isDriver, myDriverRecord, txPeriod]);

  // Transaction history chart (credits vs debits by month)
  const txChartData = useMemo(() => {
    const months = [];
    const txSource = isDriver ? transactions.filter(t => myDriverRecord && t.driver_id === myDriverRecord.id) : transactions;
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM yy');
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inMonth = txSource.filter(t => isWithinInterval(new Date(t.created_date), { start, end }));
      const credits = inMonth.filter(t => t.type === 'earned' || t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
      const debits = inMonth.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
      months.push({ label, Créditos: Math.round(credits), Débitos: Math.round(debits) });
    }
    return months;
  }, [transactions, isDriver, myDriverRecord]);

  // Mutations
  const createTxMutation = useMutation({
    mutationFn: async (d) => {
      const res = await base44.entities.UPITransaction.create(d);
      const driver = drivers.find(dr => dr.id === d.driver_id);
      if (driver && d.type !== 'earned') {
        const delta = d.type === 'credit' ? d.amount : -d.amount;
        await base44.entities.Driver.update(driver.id, { upi_balance: Math.max(0, (driver.upi_balance || 0) + delta) });
        qc.invalidateQueries({ queryKey: ['drivers'] });
      }
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-transactions'] }); setShowForm(false); setEditing(null); },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (transaction) => {
      const driver = drivers.find(d => d.id === transaction.driver_id);
      if (driver) {
        const delta = transaction.type === 'credit' ? -transaction.amount : transaction.type === 'debit' ? transaction.amount : -transaction.amount;
        await base44.entities.Driver.update(driver.id, { upi_balance: Math.max(0, (driver.upi_balance || 0) + delta) });
      }
      return await base44.entities.UPITransaction.delete(transaction.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-transactions'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); setEditing(null); setShowForm(false); },
  });

  const createOrderMutation = useMutation({
    mutationFn: (d) => base44.entities.UPIOrder.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-orders'] }); setShowSellDialog(false); setSellForm({ quantity: '', price_per_upi: '' }); },
  });

  const fillOrderMutation = useMutation({
    mutationFn: async (order) => {
      // Admin buys: pay seller (credit their cash equivalent via a note), deduct from seller's UPI
      const seller = drivers.find(d => d.id === order.seller_id);
      if (seller) {
        await base44.entities.Driver.update(seller.id, { upi_balance: Math.max(0, (seller.upi_balance || 0) - order.quantity) });
      }
      await base44.entities.UPITransaction.create({
        driver_id: order.seller_id,
        driver_name: order.seller_name,
        type: 'debit',
        amount: order.quantity,
        source: 'upi_sale',
        notes: `Venda UPI - ${order.quantity} × €${order.price_per_upi} = €${(order.quantity * order.price_per_upi).toFixed(2)}`,
        processed_by: currentUser?.email,
      });
      return base44.entities.UPIOrder.update(order.id, {
        status: 'filled',
        filled_by: currentUser?.email,
        filled_at: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-orders'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); qc.invalidateQueries({ queryKey: ['upi-transactions'] }); },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id) => base44.entities.UPIOrder.update(id, { status: 'cancelled' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['upi-orders'] }),
  });

  // Auto-buy: fill all orders at or below threshold
  const autoBuyMutation = useMutation({
    mutationFn: async (threshold) => {
      const eligible = openOrders.filter(o => o.price_per_upi <= threshold);
      for (const order of eligible) {
        const seller = drivers.find(d => d.id === order.seller_id);
        if (seller) {
          await base44.entities.Driver.update(seller.id, { upi_balance: Math.max(0, (seller.upi_balance || 0) - order.quantity) });
        }
        await base44.entities.UPITransaction.create({
          driver_id: order.seller_id, driver_name: order.seller_name,
          type: 'debit', amount: order.quantity, source: 'upi_auto_buy',
          notes: `Auto-compra UPI - €${order.price_per_upi}/UPI`, processed_by: 'system',
        });
        await base44.entities.UPIOrder.update(order.id, { status: 'filled', filled_by: currentUser?.email, filled_at: new Date().toISOString().split('T')[0] });
      }
      return eligible.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['upi-orders'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['upi-transactions'] });
      setShowAutoBuyDialog(false);
      alert(`${count} ordem(ns) executada(s) automaticamente.`);
    },
  });

  const totalUPI = Math.round(drivers.reduce((s, d) => s + (d.upi_balance || 0), 0) * 100) / 100;
  const totalEarned = Math.round(transactions.filter(t => t.type === 'earned').reduce((s, t) => s + (t.amount || 0), 0) * 100) / 100;

  const [form, setForm] = useState({ driver_id: '', type: 'credit', amount: '', notes: '' });
  React.useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ driver_id: '', type: 'credit', amount: '', notes: '' });
  }, [editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await base44.entities.UPITransaction.update(editing.id, { amount: parseFloat(form.amount), notes: form.notes });
      qc.invalidateQueries({ queryKey: ['upi-transactions'] });
      setEditing(null); setShowForm(false);
    } else {
      const driver = drivers.find(d => d.id === form.driver_id);
      await createTxMutation.mutateAsync({
        ...form, driver_name: driver?.full_name || '',
        amount: parseFloat(form.amount),
        source: 'admin_adjustment', processed_by: currentUser?.email,
      });
    }
  };

  const handleSellOrder = async (e) => {
    e.preventDefault();
    if (!myDriverRecord) return;
    const qty = parseFloat(sellForm.quantity);
    if (qty > myBalance) { alert('Saldo insuficiente'); return; }
    await createOrderMutation.mutateAsync({
      seller_id: myDriverRecord.id,
      seller_name: myDriverRecord.full_name,
      quantity: qty,
      price_per_upi: parseFloat(sellForm.price_per_upi),
    });
  };

  const topDrivers = [...drivers].filter(d => d.upi_balance > 0).sort((a, b) => (b.upi_balance || 0) - (a.upi_balance || 0)).slice(0, 10);

  const txColumns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Tipo', render: (r) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.type === 'earned' ? 'bg-indigo-50 text-indigo-700' : r.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {r.type === 'earned' ? 'Ganho' : r.type === 'credit' ? 'Creditado' : r.source === 'upi_sale' ? 'Venda' : 'Debitado'}
      </span>
    )},
    { header: 'Montante', render: (r) => <span className="font-medium">{r.amount} UPI</span> },
    { header: 'Origem', render: (r) => <span className="text-sm text-gray-500">{r.source}</span> },
    { header: 'Data', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_date), 'dd/MM/yyyy')}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Moeda UPI"
        subtitle={isDriver ? `O meu saldo: ${myBalance} UPI` : "4% dos rendimentos Uber + Bolt"}
        actionLabel={isAdmin ? "Ajustar UPI" : undefined}
        onAction={isAdmin ? () => setShowForm(true) : undefined}
      >
        {isAdmin && (
          <Button onClick={() => setShowAutoBuyDialog(true)} variant="outline" className="gap-2">
            <Settings className="w-4 h-4" /> Auto-compra
          </Button>
        )}
        {(isDriver || (!isAdmin && myDriverRecord)) && myBalance > 0 && (
          <Button onClick={() => setShowSellDialog(true)} className="bg-violet-600 hover:bg-violet-700 gap-2">
            <ShoppingBag className="w-4 h-4" /> Vender UPI
          </Button>
        )}
      </PageHeader>

      {/* Balances for admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="UPI total em circulação" value={`${totalUPI.toLocaleString()} UPI`} icon={Coins} color="violet" />
          <StatCard title="UPI ganhos (auto)" value={`${totalEarned.toLocaleString()} UPI`} icon={TrendingUp} color="indigo" />
          <StatCard title="Motoristas com UPI" value={drivers.filter(d => d.upi_balance > 0).length} icon={Users} color="blue" />
        </div>
      )}

      {/* Driver balance card */}
      {isDriver && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">O meu saldo UPI</p>
                <Coins className="w-5 h-5 text-violet-500" />
              </div>
              <p className="text-3xl font-bold text-violet-700">{myBalance} <span className="text-lg font-normal">UPI</span></p>
            </CardContent>
          </Card>
          {bestAsk && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">Melhor preço de venda (ASK)</p>
                  <ArrowDownUp className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-emerald-600">€{bestAsk.toFixed(2)} <span className="text-lg font-normal">/UPI</span></p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue={isDriver ? "transactions" : "overview"}>
        <TabsList>
          {!isDriver && <TabsTrigger value="overview">Visão geral</TabsTrigger>}
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="market">Mercado UPI</TabsTrigger>
        </TabsList>

        {/* Overview tab (admin only) */}
        {!isDriver && (
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Top detentores UPI</CardTitle></CardHeader>
                <CardContent>
                  {topDrivers.length === 0 ? (
                    <p className="text-center py-6 text-sm text-gray-400">Nenhum UPI distribuído</p>
                  ) : (
                    <div className="space-y-2">
                      {topDrivers.map((d, i) => (
                        <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-400 w-5">#{i + 1}</span>
                            <span className="text-sm font-medium">{d.full_name}</span>
                          </div>
                          <span className="text-sm font-bold text-violet-600">{d.upi_balance} UPI</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Price chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução do preço UPI (6 meses)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={priceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={v => v ? `€${v.toFixed(2)}` : 'Sem dados'} />
                      <Line type="monotone" dataKey="price" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} name="Preço médio" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Transactions */}
        <TabsContent value="transactions">
          {isDriver && (
            <div className="flex gap-2 mb-3">
              {['all', 'week', 'month', 'year'].map(p => (
                <button key={p} onClick={() => setTxPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${txPeriod === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p === 'all' ? 'Tudo' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Ano'}
                </button>
              ))}
            </div>
          )}
          <DataTable columns={txColumns} data={filteredMyTx} isLoading={isLoading} emptyMessage="Nenhuma transação UPI"
            onRowClick={isAdmin ? (t) => { setEditing(t); setShowForm(true); } : undefined} />
        </TabsContent>

        {/* History chart */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Histórico de Transações UPI (6 meses)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={txChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Créditos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Débitos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market - Order book */}
        <TabsContent value="market">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Order book */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-violet-500" />
                  Order Book — Ofertas de venda (ASK)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {openOrders.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-400">Nenhuma oferta de venda ativa</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 text-xs font-medium text-gray-500 px-2 mb-1">
                      <span>Vendedor</span><span className="text-right">Qtd</span><span className="text-right">Preço/UPI</span><span className="text-right">Total</span>
                    </div>
                    {openOrders.map((o) => (
                      <div key={o.id} className="grid grid-cols-4 items-center p-2.5 bg-violet-50 border border-violet-100 rounded-lg text-sm">
                        <span className="font-medium text-gray-800 truncate">{o.seller_name?.split(' ')[0]}</span>
                        <span className="text-right font-medium">{o.quantity} UPI</span>
                        <span className="text-right text-violet-700 font-semibold">€{o.price_per_upi.toFixed(2)}</span>
                        <div className="flex justify-end gap-1">
                          <span className="text-gray-600 text-xs mr-1">€{(o.quantity * o.price_per_upi).toFixed(0)}</span>
                          {isAdmin && (
                            <button onClick={() => { if (confirm(`Comprar ${o.quantity} UPI de ${o.seller_name} por €${(o.quantity * o.price_per_upi).toFixed(2)}?`)) fillOrderMutation.mutate(o); }}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            </button>
                          )}
                          {isDriver && myDriverRecord?.id === o.seller_id && (
                            <button onClick={() => cancelOrderMutation.mutate(o.id)} className="text-xs text-red-500 hover:underline">cancelar</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price history chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução do preço UPI (6 meses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip formatter={v => v ? `€${Number(v).toFixed(2)}` : 'Sem dados'} />
                    <Line type="monotone" dataKey="price" stroke="#7c3aed" strokeWidth={2} dot={{ r: 5 }} name="Preço médio" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                {openOrders.length > 0 && (
                  <div className="mt-3 flex gap-4 text-sm">
                    <div className="bg-violet-50 px-3 py-2 rounded-lg flex-1 text-center">
                      <p className="text-xs text-gray-500">Melhor ASK</p>
                      <p className="font-bold text-violet-700">€{openOrders[0].price_per_upi.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 px-3 py-2 rounded-lg flex-1 text-center">
                      <p className="text-xs text-gray-500">UPI à venda</p>
                      <p className="font-bold text-gray-700">{openOrders.reduce((s, o) => s + o.quantity, 0)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* My open orders (driver) */}
            {isDriver && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">As minhas ordens de venda</CardTitle></CardHeader>
                <CardContent>
                  {orders.filter(o => o.seller_id === myDriverRecord?.id).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma ordem colocada</p>
                  ) : (
                    <div className="space-y-2">
                      {orders.filter(o => o.seller_id === myDriverRecord?.id).map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">{o.quantity} UPI</span> a <span className="text-violet-700 font-semibold">€{o.price_per_upi.toFixed(2)}/UPI</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={o.status === 'open' ? 'bg-green-100 text-green-700' : o.status === 'filled' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}>
                              {o.status === 'open' ? 'Aberta' : o.status === 'filled' ? 'Executada' : 'Cancelada'}
                            </Badge>
                            {o.status === 'open' && (
                              <button onClick={() => cancelOrderMutation.mutate(o.id)} className="text-xs text-red-500 hover:underline">Cancelar</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Admin: adjust UPI dialog */}
      {isAdmin && (
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Ajustar'} UPI</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs">Motorista</Label>
                    <Select value={form.driver_id} onValueChange={(v) => setForm(f => ({ ...f, driver_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                      <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name} ({d.upi_balance || 0} UPI)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Creditar</SelectItem>
                        <SelectItem value="debit">Debitar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-1.5"><Label className="text-xs">Montante UPI</Label><Input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Input value={form.notes || ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex gap-2">
                {editing && <Button type="button" variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar transação?')) deleteTxMutation.mutate(editing); }}>Eliminar</Button>}
                <Button type="submit" disabled={createTxMutation.isPending} className={editing ? "flex-1 bg-indigo-600" : "w-full bg-indigo-600"}>{editing ? 'Atualizar' : 'Confirmar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Driver: sell UPI dialog */}
      {isDriver && (
        <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Vender os meus UPI</DialogTitle></DialogHeader>
            <div className="bg-violet-50 p-3 rounded-lg text-sm mb-2">
              <p className="text-violet-700">Saldo disponível: <strong>{myBalance} UPI</strong></p>
              {bestAsk && <p className="text-gray-600 mt-1">Melhor preço atual no mercado: <strong>€{bestAsk.toFixed(2)}/UPI</strong></p>}
            </div>
            <form onSubmit={handleSellOrder} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade a vender</Label>
                <Input type="number" min="1" max={myBalance} step="1" value={sellForm.quantity}
                  onChange={(e) => setSellForm(f => ({ ...f, quantity: e.target.value }))} required placeholder={`Máx: ${myBalance}`} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço por UPI (€)</Label>
                <Input type="number" min="0.01" step="0.01" value={sellForm.price_per_upi}
                  onChange={(e) => setSellForm(f => ({ ...f, price_per_upi: e.target.value }))} required />
              </div>
              {sellForm.quantity && sellForm.price_per_upi && (
                <div className="bg-indigo-50 p-3 rounded-lg text-sm">
                  Total estimado: <strong className="text-indigo-700">€{(parseFloat(sellForm.quantity) * parseFloat(sellForm.price_per_upi)).toFixed(2)}</strong>
                </div>
              )}
              <p className="text-xs text-gray-500">A sua ordem ficará no order book até ser comprada pelo administrador (a empresa).</p>
              <Button type="submit" disabled={createOrderMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">
                {createOrderMutation.isPending ? 'A colocar...' : 'Colocar ordem de venda'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}