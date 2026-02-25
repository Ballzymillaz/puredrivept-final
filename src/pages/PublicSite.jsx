import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Shield, CreditCard, BarChart3, Users, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'Gestion des chauffeurs', desc: 'Contrôle complet de l\'inscription, documentation et performances de votre flotte.' },
  { icon: Car, title: 'Flotte de véhicules', desc: 'Suivi en temps réel de vos véhicules, assurances et contrôles techniques.' },
  { icon: CreditCard, title: 'Paiements automatiques', desc: 'Consolidation hebdomadaire automatique des gains Uber, Bolt et autres plateformes.' },
  { icon: Shield, title: 'Conformité loi 45/2018', desc: 'Gestion documentaire complète avec alertes d\'échéance intelligentes.' },
  { icon: BarChart3, title: 'Rapports détaillés', desc: 'Tableaux de bord intuitifs et analyses de rentabilité par chauffeur et véhicule.' },
  { icon: Zap, title: 'Intégrations natives', desc: 'Uber, Bolt, Via Verde, MyPRIO, Miio — tout connecté en un seul endroit.' },
];

const OFFERS = [
  { name: 'Slot Standard', price: '35€', period: '/semaine', features: ['Slot sur nos licences TVDE', 'Accès plateforme chauffeur', 'Support par email'] },
  { name: 'Slot Premium', price: '45€', period: '/semaine', features: ['Tout Standard +', 'Priorité de support', 'Rapports détaillés'], highlight: true },
  { name: 'Slot Black', price: '99€', period: '/semaine', features: ['Tout Premium +', 'Assurance TVDE incluse', 'Support prioritaire 24/7'] },
  { name: 'Location', price: 'Sur devis', period: '', features: ['Véhicule fourni', 'Assurance incluse', 'Entretien couvert', 'Option d\'achat'] },
];

export default function PublicSite() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">PD</span>
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">PureDrive<sup className="text-[8px]">PT</sup></span>
          </div>
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Apply')}>
              <Button variant="ghost" className="text-sm">Postuler</Button>
            </Link>
            <Link to={createPageUrl('Dashboard')}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-sm">Espace membre</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" /> Plateforme TVDE #1 au Portugal
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
            Gérez votre flotte <br />
            <span className="text-indigo-600">TVDE</span> en toute simplicité
          </h1>
          <p className="text-lg text-gray-500 mt-6 max-w-2xl mx-auto leading-relaxed">
            PureDrive<sup>PT</sup> est la plateforme tout-en-un pour gérer vos chauffeurs, véhicules, paiements et conformité. Conforme à la loi 45/2018.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link to={createPageUrl('Apply')}>
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-base gap-2">
                Rejoindre maintenant <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Tout ce dont vous avez besoin</h2>
            <p className="text-gray-500 mt-3">Une plateforme complète pour l'industrie TVDE</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Nos offres</h2>
            <p className="text-gray-500 mt-3">Choisissez la formule adaptée à vos besoins</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {OFFERS.map((o, i) => (
              <Card key={i} className={`border-0 shadow-sm ${o.highlight ? 'ring-2 ring-indigo-600 shadow-lg' : ''}`}>
                <CardContent className="p-6">
                  {o.highlight && <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Populaire</span>}
                  <h3 className="font-semibold text-gray-900 mt-3 mb-1">{o.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold text-gray-900">{o.price}</span>
                    <span className="text-gray-500 text-sm">{o.period}</span>
                  </div>
                  <div className="space-y-2">
                    {o.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <Link to={createPageUrl('Apply')}>
                    <Button className={`w-full mt-6 ${o.highlight ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`} variant={o.highlight ? 'default' : 'outline'}>
                      Commencer
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">PD</span>
            </div>
            <span className="text-sm text-gray-500">© 2026 PureDrive<sup>PT</sup>. Tous droits réservés.</span>
          </div>
          <p className="text-sm text-gray-400">Conforme à la loi 45/2018 — Portugal</p>
        </div>
      </footer>
    </div>
  );
}