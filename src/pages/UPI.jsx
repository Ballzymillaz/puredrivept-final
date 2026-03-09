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
import { Coins, TrendingUp, Users, ShoppingBag, ArrowDownUp, CheckCircle2, Settings, Lock, Unlock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { format, addYears, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Vesting: 25% per year over 4 years
function computeVesting(transaction) {
  const createdYear = new Date(transaction.created_date).getFullYear();
  const currentYear = new Date().getFullYear();
  const yearsPassed = currentYear - createdYear;
  const ratio = Math.min(yearsPassed * 0.25, 1);
  const total = transaction.amount || 0;
  return {
    total,
    vested: Math.round(total * ratio * 100) / 100,
    locked: Math.round(total * (1 - ratio) * 100) / 100,
    ratio,
    nextRelease: addYears(new Date(transaction.created_date), yearsPassed + 1),
    nextAmount: Math.round(total * 0.25 * 100) / 100,
    fullyVested: ratio >= 1,
  };
}

// Aggregate vesting across all transactions for a driver
function aggregateVesting(transactions) {
  let totalVested = 0, totalLocked = 0, totalUPI = 0;
  let earliestNext = null, nextAmount = 0;
  transactions.filter(t => t.type === 'earned' || t.type === 'credit').forEach(t => {
    const v = computeVesting(t);
    totalUPI += v.total;
    totalVested += v.vested;
    totalLocked += v.locked;
    if (!v.fullyVested) {
      if (!earliestNext || v.nextRelease < earliestNext) {
        earliestNext = v.nextRelease;
        nextAmount = v.nextAmount;
      }
    }
  });
  // Subtract debits
  const totalDebits = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
  totalVested = Math.max(0, totalVested - totalDebits);
  return { totalUPI, totalVested: Math.round(totalVested * 100) / 100, totalLocked: Math.round(totalLocked * 100) / 100, earliestNext, nextAmount };
}

// No static reserve — company UPI is dynamically computed as sum of all earned UPI (1:1 matching)

export default function UPI({ currentUser }) {
  const isSimulation = !!currentUser?._isSimulation;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [showAutoBuyDialog, setShowAutoBuyDialog] = useState(false);
  const [autoBuyThreshold, setAutoBuyThreshold] = useState('');
  const [sellForm, setSellForm] = useState({ quantity: '', price_per_upi: '' });
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = (currentUser?.role === 'fleet_manager') && !isAdmin;
  const isDriver = (currentUser?.role === 'driver' || currentUser?.hasRole?.('driver')) && !isAdmin;

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
  const myTxs = useMemo(() => isDriver && myDriverRecord ? transactions.filter(t => t.driver_id === myDriverRecord.id) : [], [transactions, isDriver, myDriverRecord]);
  const myVesting = useMemo(() => isDriver && myDriverRecord ? aggregateVesting(myTxs) : null, [myTxs, isDriver, myDriverRecord]);

  const openOrders = orders.filter(o => o.status === 'open').sort((a, b) => a.price_per_upi - b.price_per_upi);
  const bestAsk = openOrders.length > 0 ? openOrders[0].price_per_upi : null;

  // UPI totals — company UPI = sum of all "earned" transactions (1:1 synchronised emission)
  const totalDriverUPI = Math.round(drivers.reduce((s, d) => s + (d.upi_balance || 0), 0) * 100) / 100;
  const companyUPI = Math.round(transactions.filter(t => t.type === 'earned').reduce((s, t) => s + (t.amount || 0), 0) * 100) / 100;
  const totalCirculation = totalDriverUPI + companyUPI;

  // Per-driver vesting for admin overview
  const driverVestingOverview = useMemo(() => {
    if (!isAdmin) return [];
    return drivers.filter(d => d.upi_balance > 0).map(d => {
      const dTxs = transactions.filter(t => t.driver_id === d.id);
      const v = aggregateVesting(dTxs);
      return { ...d, ...v };
    }).sort((a, b) => b.upi_balance - a.upi_balance);
  }, [drivers, transactions, isAdmin]);

  // Price chart
  const priceChartData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const label = format(d, 'MMM yy');
    const mStart = startOfMonth(d).toISOString().split('T')[0];
    const mEnd = endOfMonth(d).toISOString().split('T')[0];
    const filled = orders.filter(o => o.status === 'filled' && o.filled_at >= mStart && o.filled_at <= mEnd);
    const avg = filled.length > 0 ? filled.reduce((s, o) => s + o.price_per_upi, 0) / filled.length : null;
    return { label, price: avg };
  }), [orders]);

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
    mutationFn: async (tx) => {
      const driver = drivers.find(d => d.id === tx.driver_id);
      if (driver) {
        const delta = tx.type === 'credit' ? -tx.amount : tx.type === 'debit' ? tx.amount : -tx.amount;
        await base44.entities.Driver.update(driver.id, { upi_balance: Math.max(0, (driver.upi_balance || 0) + delta) });
      }
      return base44.entities.UPITransaction.delete(tx.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-transactions'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); setEditing(null); setShowForm(false); },
  });

  const createOrderMutation = useMutation({
    mutationFn: (d) => base44.entities.UPIOrder.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-orders'] }); setShowSellDialog(false); setSellForm({ quantity: '', price_per_upi: '' }); },
  });

  const fillOrderMutation = useMutation({
    mutationFn: async (order) => {
      const seller = drivers.find(d => d.id === order.seller_id);
      if (seller) await base44.entities.Driver.update(seller.id, { upi_balance: Math.max(0, (seller.upi_balance || 0) - order.quantity) });
      await base44.entities.UPITransaction.create({ driver_id: order.seller_id, driver_name: order.seller_name, type: 'debit', amount: order.quantity, source: 'upi_sale', notes: `Venda UPI - ${order.quantity} × €${order.price_per_upi}`, processed_by: currentUser?.email });
      return base44.entities.UPIOrder.update(order.id, { status: 'filled', filled_by: currentUser?.email, filled_at: new Date().toISOString().split('T')[0] });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-orders', 'drivers', 'upi-transactions'] }); },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id) => base44.entities.UPIOrder.update(id, { status: 'cancelled' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['upi-orders'] }),
  });

  const autoBuyMutation = useMutation({
    mutationFn: async (threshold) => {
      const eligible = openOrders.filter(o => o.price_per_upi <= threshold);
      for (const order of eligible) {
        const seller = drivers.find(d => d.id === order.seller_id);
        if (seller) await base44.entities.Driver.update(seller.id, { upi_balance: Math.max(0, (seller.upi_balance || 0) - order.quantity) });
        await base44.entities.UPITransaction.create({ driver_id: order.seller_id, driver_name: order.seller_name, type: 'debit', amount: order.quantity, source: 'upi_auto_buy', notes: `Auto-compra - €${order.price_per_upi}/UPI`, processed_by: 'system' });
        await base44.entities.UPIOrder.update(order.id, { status: 'filled', filled_by: currentUser?.email, filled_at: new Date().toISOString().split('T')[0] });
      }
      return eligible.length;
    },
    onSuccess: (count) => { qc.invalidateQueries({ queryKey: ['upi-orders'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); qc.invalidateQueries({ queryKey: ['upi-transactions'] }); setShowAutoBuyDialog(false); alert(`${count} ordem(ns) executada(s).`); },
  });

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
      await createTxMutation.mutateAsync({ ...form, driver_name: driver?.full_name || '', amount: parseFloat(form.amount), source: 'admin_adjustment', processed_by: currentUser?.email });
    }
  };

  const handleSell = async (e) => {
    e.preventDefault();
    if (!myDriverRecord || !myVesting) return;
    const qty = parseFloat(sellForm.quantity);
    if (qty > myVesting.totalVested) { alert('Apenas pode vender UPI vestidos (desbloqueados)'); return; }
    await createOrderMutation.mutateAsync({ seller_id: myDriverRecord.id, seller_name: myDriverRecord.full_name, quantity: qty, price_per_upi: parseFloat(sellForm.price_per_upi) });
  };

  const txColumns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Tipo', render: (r) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.type === 'earned' ? 'bg-indigo-50 text-indigo-700' : r.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {r.type === 'earned' ? 'Ganho' : r.type === 'credit' ? 'Creditado' : 'Debitado'}
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
        subtitle={isDriver ? `O meu saldo vestido: ${myVesting?.totalVested || 0} UPI` : "4% dos rendimentos Uber + Bolt · Vesting anual 25%"}
        actionLabel={isAdmin && !isSimulation ? "Ajustar UPI" : undefined}
        onAction={isAdmin && !isSimulation ? () => setShowForm(true) : undefined}
      >
        {isAdmin && !isSimulation && <Button onClick={() => setShowAutoBuyDialog(true)} variant="outline" className="gap-2"><Settings className="w-4 h-4" /> Auto-compra</Button>}
        {isDriver && !isSimulation && (myVesting?.totalVested || 0) > 0 && (
          <Button onClick={() => setShowSellDialog(true)} className="bg-violet-600 hover:bg-violet-700 gap-2">
            <ShoppingBag className="w-4 h-4" /> Vender UPI
          </Button>
        )}
      </PageHeader>

      {/* Admin stats */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="UPI em circulação (total)" value={`${totalCirculation.toLocaleString()} UPI`} icon={Coins} color="violet" />
          <StatCard title="UPI motoristas" value={`${totalDriverUPI.toLocaleString()} UPI`} icon={Users} color="indigo" />
          <StatCard title="UPI Empresa (matching 1:1)" value={`${companyUPI.toLocaleString()} UPI`} icon={TrendingUp} color="blue" />
        </div>
      )}

      {/* Driver: vesting timeline */}
      {isDriver && myVesting && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-gray-800 mb-4">O meu portfolio UPI</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-violet-50 rounded-xl p-3 text-center">
                <Coins className="w-5 h-5 text-violet-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">UPI Total</p>
                <p className="text-2xl font-bold text-violet-700">{myVesting.totalUPI}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <Unlock className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Disponíveis (vestidos)</p>
                <p className="text-2xl font-bold text-emerald-700">{myVesting.totalVested}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <Lock className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Bloqueados</p>
                <p className="text-2xl font-bold text-orange-700">{myVesting.totalLocked}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Próxima libertação</p>
                {myVesting.earliestNext ? (
                  <>
                    <p className="text-sm font-bold text-blue-700">{myVesting.nextAmount} UPI</p>
                    <p className="text-xs text-blue-600">{format(myVesting.earliestNext, 'dd/MM/yyyy')}</p>
                  </>
                ) : <p className="text-sm font-medium text-gray-400">100% vestido</p>}
              </div>
            </div>
            {myVesting.totalUPI > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Vesting: {Math.round((myVesting.totalVested / myVesting.totalUPI) * 100)}%</span>
                  <span>{myVesting.totalVested} / {myVesting.totalUPI} UPI</span>
                </div>
                <Progress value={(myVesting.totalVested / myVesting.totalUPI) * 100} className="h-2" />
              </div>
            )}
            {isDriver && myVesting.totalLocked > 0 && (
              <p className="text-xs text-orange-600 mt-3 bg-orange-50 p-2 rounded-lg">
                ⚠️ Em caso de saída, os UPI bloqueados são perdidos definitivamente.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={isDriver ? "market" : "overview"}>
        <TabsList>
          {!isDriver && <TabsTrigger value="overview">Visão geral</TabsTrigger>}
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="market">Mercado UPI</TabsTrigger>
        </TabsList>

        {/* Admin overview */}
        {!isDriver && (
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top detentores + Vesting</CardTitle></CardHeader>
                <CardContent>
                  {driverVestingOverview.length === 0 ? (
                    <p className="text-center py-6 text-sm text-gray-400">Nenhum UPI distribuído</p>
                  ) : (
                    <div className="space-y-2">
                      {driverVestingOverview.slice(0, 8).map((d, i) => (
                        <div key={d.id} className="p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{d.full_name}</span>
                            <span className="text-sm font-bold text-violet-600">{d.upi_balance} UPI</span>
                          </div>
                          <div className="flex gap-2 text-[10px]">
                            <span className="text-emerald-600">✓ {d.totalVested} vestido</span>
                            <span className="text-orange-500">🔒 {d.totalLocked} bloqueado</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm lg:col-span-2">
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
          <DataTable columns={txColumns} data={isDriver ? myTxs : transactions} isLoading={isLoading} emptyMessage="Nenhuma transação UPI"
            onRowClick={isAdmin ? (t) => { setEditing(t); setShowForm(true); } : undefined} />
        </TabsContent>

        {/* Market */}
        <TabsContent value="market">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><ArrowDownUp className="w-4 h-4 text-violet-500" /> Order Book — Ofertas de venda (ASK)</CardTitle>
              </CardHeader>
              <CardContent>
                {openOrders.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-400">Nenhuma oferta de venda ativa</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 text-xs font-medium text-gray-500 px-2 mb-1">
                      <span>Vendedor</span><span className="text-right">Qtd</span><span className="text-right">Preço/UPI</span><span className="text-right">Ação</span>
                    </div>
                    {openOrders.map(o => (
                      <div key={o.id} className="grid grid-cols-4 items-center p-2.5 bg-violet-50 border border-violet-100 rounded-lg text-sm">
                        <span className="font-medium text-gray-800 truncate">{o.seller_name?.split(' ')[0]}</span>
                        <span className="text-right">{o.quantity} UPI</span>
                        <span className="text-right text-violet-700 font-semibold">€{o.price_per_upi.toFixed(2)}</span>
                        <div className="flex justify-end gap-1">
                          {isAdmin && !isSimulation && (
                            <button onClick={() => { if (confirm(`Comprar ${o.quantity} UPI de ${o.seller_name}?`)) fillOrderMutation.mutate(o); }}
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
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução do preço UPI (6 meses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
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
            {isDriver && (
              <Card className="border-0 shadow-sm lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">As minhas ordens de venda</CardTitle></CardHeader>
                <CardContent>
                  {orders.filter(o => o.seller_id === myDriverRecord?.id).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma ordem colocada</p>
                  ) : (
                    <div className="space-y-2">
                      {orders.filter(o => o.seller_id === myDriverRecord?.id).map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div><span className="font-medium">{o.quantity} UPI</span> a <span className="text-violet-700 font-semibold">€{o.price_per_upi.toFixed(2)}/UPI</span></div>
                          <div className="flex items-center gap-3">
                            <Badge className={o.status === 'open' ? 'bg-green-100 text-green-700' : o.status === 'filled' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}>
                              {o.status === 'open' ? 'Aberta' : o.status === 'filled' ? 'Executada' : 'Cancelada'}
                            </Badge>
                            {o.status === 'open' && <button onClick={() => cancelOrderMutation.mutate(o.id)} className="text-xs text-red-500 hover:underline">Cancelar</button>}
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

      {/* Auto-buy dialog */}
      {isAdmin && (
        <Dialog open={showAutoBuyDialog} onOpenChange={setShowAutoBuyDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Auto-compra UPI</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Define um preço máximo. Todas as ordens ≤ ao limite serão compradas automaticamente.</p>
              {openOrders.length > 0 && (
                <div className="bg-violet-50 p-3 rounded-lg text-sm">
                  <p>Melhor ASK: <strong className="text-violet-700">€{openOrders[0].price_per_upi.toFixed(2)}</strong></p>
                  <p className="text-gray-500">{openOrders.length} ordem(ns) abertas</p>
                </div>
              )}
              <div className="space-y-1.5"><Label className="text-xs">Preço máximo por UPI (€)</Label><Input type="number" step="0.01" min="0.01" value={autoBuyThreshold} onChange={e => setAutoBuyThreshold(e.target.value)} placeholder="Ex: 1.50" /></div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAutoBuyDialog(false)}>Cancelar</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!autoBuyThreshold || autoBuyMutation.isPending} onClick={() => autoBuyMutation.mutate(parseFloat(autoBuyThreshold))}>
                  {autoBuyMutation.isPending ? 'A executar...' : 'Executar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Adjust UPI */}
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

      {/* Sell dialog */}
      {isDriver && (
        <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Vender UPI (vestidos)</DialogTitle></DialogHeader>
            <div className="bg-violet-50 p-3 rounded-lg text-sm mb-2 space-y-1">
              <p className="text-violet-700">UPI disponíveis (vestidos): <strong>{myVesting?.totalVested || 0}</strong></p>
              <p className="text-orange-600">UPI bloqueados: <strong>{myVesting?.totalLocked || 0}</strong> (não vendáveis)</p>
              {bestAsk && <p className="text-gray-600">Melhor preço mercado: <strong>€{bestAsk.toFixed(2)}/UPI</strong></p>}
            </div>
            <form onSubmit={handleSell} className="space-y-4">
              <div className="space-y-1.5"><Label className="text-xs">Quantidade (máx: {myVesting?.totalVested || 0})</Label>
                <Input type="number" min="1" max={myVesting?.totalVested || 0} step="1" value={sellForm.quantity} onChange={(e) => setSellForm(f => ({ ...f, quantity: e.target.value }))} required />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Preço por UPI (€)</Label>
                <Input type="number" min="0.01" step="0.01" value={sellForm.price_per_upi} onChange={(e) => setSellForm(f => ({ ...f, price_per_upi: e.target.value }))} required />
              </div>
              {sellForm.quantity && sellForm.price_per_upi && (
                <div className="bg-indigo-50 p-3 rounded-lg text-sm">Total estimado: <strong className="text-indigo-700">€{(parseFloat(sellForm.quantity) * parseFloat(sellForm.price_per_upi)).toFixed(2)}</strong></div>
              )}
              <p className="text-xs text-gray-500">A ordem fica no order book até ser comprada pela empresa.</p>
              <Button type="submit" disabled={createOrderMutation.isPending} className="w-full bg-violet-600 hover:bg-violet-700">Colocar ordem de venda</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}