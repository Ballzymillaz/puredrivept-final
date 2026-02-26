import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Shield, TrendingUp, Clock, Target, ChevronRight, Award, Euro } from 'lucide-react';

export default function PublicSite() {
  const [selectedRole, setSelectedRole] = useState(null);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['available-vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    initialData: [],
  });

  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const features = [
    { icon: Car, title: 'Veículos modernos', description: 'Frota recente e bem mantida' },
    { icon: Shield, title: 'Seguro completo', description: 'Proteção máxima incluída' },
    { icon: TrendingUp, title: 'Rendimentos atrativos', description: 'Várias fórmulas adaptadas' },
    { icon: Clock, title: 'Suporte 24/7', description: 'Assistência a qualquer momento' },
  ];

  const driverOffers = [
    { type: 'slot_standard', name: 'Slot Standard', price: '35€/semana', features: ['Veículo incluído da frota', 'Sem comissão', 'Seguro completo', 'Suporte 24/7', 'Formação incluída'] },
    { type: 'slot_premium', name: 'Slot Premium', price: '45€/semana', features: ['Veículo premium', 'Sem comissão', 'Seguro todos os riscos', 'Suporte prioritário', 'Formação avançada', 'Manutenção prioritária'] },
    { type: 'slot_black', name: 'Slot Black', price: '99€/semana', features: ['Veículo topo de gama', 'Sem comissão', 'Seguro premium', 'Suporte VIP', 'Coaching personalizado', 'Substituição imediata'] },
    { type: 'location', name: 'Aluguer de Veículo', price: 'À medida', features: ['20% comissão', 'Aluguer longa duração', 'Flexibilidade total', 'Opção de compra', 'Assistência completa', 'Veículos disponíveis'] },
  ];

  const commercialOffer = {
    title: 'Torne-se Comercial PureDrive',
    benefits: [
      { plan: 'Slot Standard', weekly: '5€/semana', description: 'Por cada motorista ativo' },
      { plan: 'Slot Premium', weekly: '5€/semana', description: 'Por cada motorista ativo' },
      { plan: 'Slot Black', weekly: '10€/semana', description: 'Por cada motorista ativo' },
      { plan: 'Aluguer', weekly: '15€/semana', description: 'Por motorista + 60€ bónus após 30 dias' },
      { plan: 'Venda Veículo', weekly: '250€', description: 'Bónus por venda em auto-financiamento', isBonus: true },
    ],
    extraBenefits: ['Sem limite de indicações', 'Pagamentos semanais', 'Rastreamento em tempo real', 'Suporte dedicado', 'Rendimento ilimitado']
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img 
              src="/uploads/Logo%20PureDrive.png" 
              alt="PureDrive" 
              className="h-10 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.parentElement.querySelector('.fallback-logo');
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <Car className="w-8 h-8 text-indigo-600 fallback-logo hidden" />
            <h1 className="text-2xl font-bold text-gray-900">PureDrive<sup className="text-xs">PT</sup></h1>
          </div>
          <div className="flex gap-4">
            {!selectedRole && (
              <button onClick={() => window.scrollTo({ top: document.getElementById('choose-role')?.offsetTop - 100 || 600, behavior: 'smooth' })} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                Começar
              </button>
            )}
            <Link to={createPageUrl('Dashboard')}>
              <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                Login
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">Junte-se à frota TVDE líder em Portugal</h2>
          <p className="text-xl text-gray-600 mb-8">Soluções flexíveis para motoristas profissionais e comerciais. Escolha o que se adapta a si.</p>
        </div>
      </section>

      {/* Choose Role */}
      <section id="choose-role" className="max-w-5xl mx-auto px-6 py-12">
        <h3 className="text-3xl font-bold text-center mb-10 text-gray-900">Escolha o seu perfil</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className={`cursor-pointer transition-all hover:shadow-xl border-2 ${selectedRole === 'driver' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`} onClick={() => setSelectedRole('driver')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center"><Car className="w-6 h-6 text-white" /></div>
                <div><CardTitle className="text-xl">Motorista TVDE</CardTitle><p className="text-sm text-gray-500">Comece a trabalhar connosco</p></div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Veículos disponíveis</li>
                <li>✓ Várias opções de contrato</li>
                <li>✓ Suporte completo</li>
                <li>✓ Formação incluída</li>
              </ul>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all hover:shadow-xl border-2 ${selectedRole === 'commercial' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}`} onClick={() => setSelectedRole('commercial')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center"><Target className="w-6 h-6 text-white" /></div>
                <div><CardTitle className="text-xl">Comercial</CardTitle><p className="text-sm text-gray-500">Ganhe indicando motoristas</p></div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Rendimento passivo</li>
                <li>✓ Sem limite de indicações</li>
                <li>✓ Pagamentos semanais</li>
                <li>✓ Bónus atrativos</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Driver Offers */}
      {selectedRole === 'driver' && (
        <section className="max-w-7xl mx-auto px-6 py-16 bg-white rounded-2xl shadow-sm my-8">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">Ofertas para Motoristas</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {driverOffers.map((offer, i) => (
              <Card key={i} className="border-2 border-gray-200 hover:border-indigo-600 transition-all">
                <CardHeader><CardTitle className="text-lg">{offer.name}</CardTitle><p className="text-2xl font-bold text-indigo-600">{offer.price}</p></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {offer.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /><span>{f}</span></li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {availableVehicles.length > 0 && (
            <div><h4 className="text-2xl font-bold text-center mb-6">Veículos Disponíveis para Aluguer</h4>
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {availableVehicles.slice(0, 8).map(v => (
                  <Card key={v.id} className="border border-gray-200"><CardContent className="p-4"><p className="font-semibold text-gray-900">{v.brand} {v.model}</p><p className="text-sm text-gray-500">{v.year} • {v.license_plate}</p>{v.weekly_rental_price && (<p className="text-indigo-600 font-bold mt-2">{v.weekly_rental_price}€/semana</p>)}</CardContent></Card>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mt-12"><Link to={createPageUrl('Apply')}><Button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-lg">Candidatar como Motorista</Button></Link></div>
        </section>
      )}

      {/* Commercial Offer */}
      {selectedRole === 'commercial' && (
        <section className="max-w-5xl mx-auto px-6 py-16 bg-white rounded-2xl shadow-sm my-8">
          <h3 className="text-3xl font-bold text-center mb-4 text-gray-900">{commercialOffer.title}</h3>
          <p className="text-xl text-center text-gray-600 mb-12">Ganhe indicando motoristas</p>

          <div className="space-y-4 mb-12">
            {commercialOffer.benefits.map((b, i) => (
              <Card key={i} className={`border-2 ${b.isBonus ? 'border-amber-200 bg-amber-50' : 'border-emerald-200'}`}><CardContent className="p-6 flex items-center justify-between"><div><p className="font-bold text-lg text-gray-900">{b.plan}</p><p className="text-sm text-gray-600">{b.description}</p></div><div className="text-right"><p className={`text-2xl font-bold ${b.isBonus ? 'text-amber-600' : 'text-emerald-600'}`}>{b.weekly}</p><p className="text-xs text-gray-500">{b.isBonus ? 'por venda' : 'por motorista'}</p></div></CardContent></Card>
            ))}
          </div>

          <Card className="bg-emerald-50 border-2 border-emerald-200 mb-8"><CardHeader><CardTitle className="text-lg">Benefícios Adicionais</CardTitle></CardHeader><CardContent><ul className="space-y-2">{commercialOffer.extraBenefits.map((b, i) => (<li key={i} className="flex items-center gap-2"><Award className="w-4 h-4 text-emerald-600" /><span>{b}</span></li>))}</ul></CardContent></Card>

          <div className="text-center"><Link to={createPageUrl('Apply')}><Button className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-lg">Candidatar como Comercial</Button></Link></div>
        </section>
      )}

      {/* Features */}
      {!selectedRole && (
        <section className="max-w-7xl mx-auto px-6 py-16">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">Porquê PureDrive?</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="text-center p-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><feature.icon className="w-8 h-8 text-indigo-600" /></div>
                <h4 className="font-semibold text-lg mb-2 text-gray-900">{feature.title}</h4>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t bg-gray-50 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-gray-600">
          <p className="mb-2">© 2025 PureDrive PT. Todos os direitos reservados.</p>
          <p className="text-sm">Gestão profissional de frotas TVDE em Portugal</p>
        </div>
      </footer>
    </div>
  );
}