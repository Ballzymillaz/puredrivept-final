import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Zap, Car, Shield, TrendingUp, ChevronRight, Award, Star } from 'lucide-react';

export default function PublicSite() {
  const [selectedRole, setSelectedRole] = useState(null);

  const { data: vehicles = [] } = useQuery({
    queryKey: ['available-vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    initialData: [],
  });

  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const fleetManagerBenefits = [
    { plan: 'Slot Standard', weekly: '5€/semana', description: 'Por cada motorista ativo' },
    { plan: 'Slot Premium', weekly: '5€/semana', description: 'Por cada motorista ativo' },
    { plan: 'Slot Black', weekly: '10€/semana', description: 'Por cada motorista ativo' },
    { plan: 'Aluguer', weekly: '15€/semana', description: 'Por motorista ativo' },
    { plan: 'Bónus 30 dias', weekly: '60€', description: 'Por motorista ativo após 30 dias', isBonus: true },
    { plan: 'Opção de compra', weekly: '250€', description: 'Bónus por cada venda concluída', isBonus: true },
  ];

  const driverBenefits = [
    'Renda fixa semanal — sem surpresas',
    '6% IVA obrigatório Uber & Bolt',
    '4% convertidos em UPI (vesting anual 25%)',
    'Sem comissões variáveis ocultas',
    'Sem taxas administrativas',
    'Opção de compra do veículo disponível',
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1526 50%, #0a1020 100%)' }}>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10" style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)' }}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">PureDrive<sup className="text-[10px] text-cyan-400">PT</sup></h1>
              <p className="text-blue-400/70 text-[10px] tracking-widest uppercase">TVDE Fleet Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => document.getElementById('choose-role')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg border border-blue-500/40 hover:border-cyan-400/60 transition-all"
              style={{ background: 'rgba(29,78,216,0.2)' }}
            >
              Começar
            </button>
            <Link to={createPageUrl('Dashboard')}>
              <button className="px-5 py-2 text-sm font-medium rounded-lg transition-all text-white" style={{ background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)', boxShadow: '0 0 16px rgba(6,182,212,0.3)' }}>
                Login
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* subtle gradient only, no visible glow blobs */}

        <div className="relative max-w-5xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 mb-8" style={{ background: 'rgba(6,182,212,0.1)' }}>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-400 text-xs font-semibold tracking-wider uppercase">Plataforma TVDE Premium</span>
          </div>

          <h2 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
            Domina o mercado TVDE<br />
            <span style={{ background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              com estrutura e potência.
            </span>
          </h2>

          <p className="text-blue-200/70 text-lg md:text-xl mb-12 max-w-2xl mx-auto">
            Modelo transparente. Veículos elétricos. Crescimento sustentável.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => { setSelectedRole('driver'); document.getElementById('role-content')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)', boxShadow: '0 0 24px rgba(6,182,212,0.4)' }}
            >
              Sou Motorista
            </button>
            <button
              onClick={() => { setSelectedRole('fleet_manager'); document.getElementById('role-content')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105 border border-cyan-500/40"
              style={{ background: 'rgba(29,78,216,0.3)', boxShadow: '0 0 24px rgba(29,78,216,0.3)' }}
            >
              Sou Fleet Manager
            </button>
          </div>
        </div>
      </section>

      {/* Choose Role */}
      <section id="choose-role" className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-center text-blue-400/60 text-xs font-semibold tracking-widest uppercase mb-8">Qual é o seu perfil?</p>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Driver */}
          <button
            onClick={() => { setSelectedRole('driver'); document.getElementById('role-content')?.scrollIntoView({ behavior: 'smooth' }); }}
            className={`p-6 rounded-2xl text-left transition-all hover:scale-[1.02] border ${selectedRole === 'driver' ? 'border-cyan-400/60' : 'border-white/10 hover:border-blue-500/40'}`}
            style={{ background: selectedRole === 'driver' ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.04)', boxShadow: selectedRole === 'driver' ? '0 0 24px rgba(6,182,212,0.2)' : 'none' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)' }}>
              <Car className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Motorista TVDE</h3>
            <p className="text-blue-300/70 text-sm mb-4">Conduza com estrutura e transparência</p>
            <ul className="space-y-1.5 text-sm text-blue-200/60">
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />Veículos premium disponíveis</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />Modelo de ganhos transparente</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />UPI — moeda interna valorizada</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-cyan-400" />Opção de compra do veículo</li>
            </ul>
          </button>

          {/* Fleet Manager */}
          <button
            onClick={() => { setSelectedRole('fleet_manager'); document.getElementById('role-content')?.scrollIntoView({ behavior: 'smooth' }); }}
            className={`p-6 rounded-2xl text-left transition-all hover:scale-[1.02] border ${selectedRole === 'fleet_manager' ? 'border-blue-400/60' : 'border-white/10 hover:border-blue-500/40'}`}
            style={{ background: selectedRole === 'fleet_manager' ? 'rgba(29,78,216,0.15)' : 'rgba(255,255,255,0.04)', boxShadow: selectedRole === 'fleet_manager' ? '0 0 24px rgba(29,78,216,0.3)' : 'none' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #7c3aed, #1d4ed8)' }}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Fleet Manager</h3>
            <p className="text-blue-300/70 text-sm mb-4">Construa a sua estrutura com previsibilidade</p>
            <ul className="space-y-1.5 text-sm text-blue-200/60">
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-blue-400" />Rendimento semanal por motorista</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-blue-400" />Bónus por fidelização</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-blue-400" />Gestão da sua frota</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3 h-3 text-blue-400" />250€ por venda em opção de compra</li>
            </ul>
          </button>
        </div>
      </section>

      {/* Role Content */}
      <div id="role-content">

        {/* Driver Section */}
        {selectedRole === 'driver' && (
          <section className="max-w-5xl mx-auto px-6 py-12 space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-black text-white mb-2">Estrutura Financeira Transparente</h3>
              <p className="text-blue-300/70">Saiba exactamente o que recebe cada semana</p>
            </div>

            {/* Financial model card */}
            <div className="rounded-2xl border border-cyan-500/30 p-6" style={{ background: 'rgba(6,182,212,0.07)', boxShadow: '0 0 32px rgba(6,182,212,0.1)' }}>
              <p className="text-xs font-semibold text-cyan-400 tracking-widest uppercase mb-4">Modelo financeiro</p>
              <ul className="space-y-3">
                {driverBenefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="text-blue-100 text-sm">{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-cyan-500/20">
                <p className="text-xs font-semibold text-cyan-400 tracking-widest uppercase mb-2">Opção de compra do veículo</p>
                <p className="text-blue-200/70 text-sm leading-relaxed">
                  A PureDrive dispõe do seu próprio sistema de financiamento interno para aquisição de veículos — sem banco, sem aprovação externa. O pagamento é deduzido diretamente do salário semanal com uma tabela degressiva por trimestre, tornando o custo progressivamente mais leve ao longo do contrato.
                </p>
              </div>
            </div>

            {/* Available vehicles */}
            {availableVehicles.length > 0 && (
              <div>
                <h4 className="text-xl font-bold text-white mb-4">Veículos Disponíveis</h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableVehicles.slice(0, 6).map(v => (
                    <div
                      key={v.id}
                      className="rounded-xl p-4 border border-white/8 transition-all hover:border-cyan-500/40 hover:scale-[1.02] flex items-center justify-between gap-3"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-cyan-300 border border-cyan-500/30 mb-2" style={{ background: 'rgba(6,182,212,0.15)' }}>
                          ● Disponível
                        </div>
                        <p className="text-white font-semibold text-sm truncate">{v.brand} {v.model}</p>
                        <p className="text-blue-400/60 text-xs mt-0.5">{v.license_plate}</p>
                        {v.weekly_rental_price && (
                          <p className="text-cyan-400 font-bold text-base mt-1">{v.weekly_rental_price}€<span className="text-xs font-normal text-blue-400/60">/semana</span></p>
                        )}
                      </div>
                      {v.photo_url ? (
                        <img src={v.photo_url} alt={`${v.brand} ${v.model}`} className="w-20 h-14 object-cover rounded-lg shrink-0 opacity-90" />
                      ) : (
                        <div className="w-20 h-14 rounded-lg shrink-0 flex items-center justify-center border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <Car className="w-6 h-6 text-blue-400/40" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center pt-4">
              <Link to={createPageUrl('Apply')}>
                <button className="px-10 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)', boxShadow: '0 0 28px rgba(6,182,212,0.4)' }}>
                  Candidatar como Motorista
                </button>
              </Link>
            </div>
          </section>
        )}

        {/* Fleet Manager Section */}
        {selectedRole === 'fleet_manager' && (
          <section className="max-w-4xl mx-auto px-6 py-12 space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-black text-white mb-2">Torne-se Fleet Manager PureDrive</h3>
              <p className="text-blue-300/70">Construa a sua própria estrutura com potência e previsibilidade.</p>
            </div>

            <div className="space-y-3">
              {fleetManagerBenefits.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${b.isBonus ? 'border-amber-500/30' : 'border-white/8'}`}
                  style={{ background: b.isBonus ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)' }}
                >
                  <div>
                    <p className="text-white font-semibold text-sm">{b.plan}</p>
                    <p className="text-blue-400/60 text-xs">{b.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${b.isBonus ? 'text-amber-400' : 'text-cyan-400'}`}>{b.weekly}</p>
                    {b.isBonus && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-amber-300 border border-amber-500/30" style={{ background: 'rgba(245,158,11,0.15)' }}>
                        <Star className="w-2.5 h-2.5" /> BÓNUS
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-blue-500/30 p-6" style={{ background: 'rgba(29,78,216,0.1)' }}>
              <p className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-4">Benefícios adicionais</p>
              <ul className="space-y-2">
                {['Sem limite de motoristas geridos', 'Pagamentos semanais garantidos', 'Dashboard exclusivo de gestão', 'Suporte dedicado Fleet Manager', 'Rendimento ilimitado e escalável'].map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-blue-100">
                    <Award className="w-4 h-4 text-blue-400 shrink-0" />{b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-center pt-4">
              <Link to={createPageUrl('Apply')}>
                <button className="px-10 py-4 rounded-xl font-bold text-white text-lg transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, #7c3aed, #1d4ed8)', boxShadow: '0 0 28px rgba(124,58,237,0.4)' }}>
                  Candidatar como Fleet Manager
                </button>
              </Link>
            </div>
          </section>
        )}

        {/* Default features */}
        {!selectedRole && (
          <section className="max-w-5xl mx-auto px-6 py-16">
            <p className="text-center text-blue-400/60 text-xs font-semibold tracking-widest uppercase mb-12">Porquê PureDrive?</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Car, title: 'Veículos Elétricos', desc: 'Frota moderna e sustentável' },
                { icon: Shield, title: 'Modelo Transparente', desc: 'Sem taxas ocultas' },
                { icon: TrendingUp, title: 'UPI Valorizado', desc: '4% convertido em moeda interna' },
                { icon: Zap, title: 'Suporte 24/7', desc: 'Assistência permanente' },
              ].map((f, i) => (
                <div key={i} className="p-6 rounded-2xl border border-white/8 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)' }}>
                    <f.icon className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-white font-bold mb-1">{f.title}</h4>
                  <p className="text-blue-400/60 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/8 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-10 text-center">
          <p className="text-blue-400/60 text-sm">© 2025 PureDrive PT. Todos os direitos reservados.</p>
          <p className="text-blue-400/40 text-xs mt-1">Gestão profissional de frotas TVDE em Portugal</p>
        </div>
      </footer>
    </div>
  );
}