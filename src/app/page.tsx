import Link from 'next/link'
import Image from 'next/image'
import { Video, Shuffle, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between p-6 max-w-md mx-auto relative overflow-hidden">
      {/* Halo de lueur chaleureux en arrière-plan (terracotta / ambre) */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header avec Logo */}
      <header className="relative z-10 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="relative rounded-2xl overflow-hidden shadow-lg shadow-red-950/40 border border-white/10 shrink-0"
            style={{ width: 44, height: 44 }}
          >
            <Image
              src="/logo.svg"
              alt="Logo Karea"
              width={44}
              height={44}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-rose-100 to-amber-200 bg-clip-text text-transparent">
              Karea
            </h1>
            <p className="text-[11px] text-amber-400/90 font-medium tracking-wide uppercase">
              Appels Vidéo en Direct
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="text-xs font-semibold text-stone-300 hover:text-white px-3.5 py-1.5 rounded-full border border-stone-800 bg-stone-900/60 backdrop-blur-sm transition-colors"
        >
          Connexion
        </Link>
      </header>

      {/* Contenu central de présentation */}
      <section className="relative z-10 py-8 flex flex-col items-center text-center">
        {/* Badge Villes / Afrique */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/90 border border-amber-500/30 text-amber-300 text-xs font-medium mb-6 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Dakar • Abidjan • Douala • Kinshasa • Lagos</span>
        </div>

        {/* Titre d'accroche chaleureux */}
        <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight mb-4">
          Voyez-vous{' '}
          <span className="bg-gradient-to-r from-[#FF5E62] via-[#E05A47] to-[#F59E0B] bg-clip-text text-transparent">
            en direct
          </span>
          , par appel vidéo.
        </h2>

        <p className="text-sm text-stone-400 max-w-xs leading-relaxed mb-6">
          Galerie de profils en temps réel, appels vidéo directs à la minute et salon de rencontre au hasard.
        </p>

        {/* 3 Cartes de présentation */}
        <div className="w-full space-y-2.5 text-left mb-4">
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-stone-900/70 border border-stone-800/80 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5 text-[#E05A47]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-200">Statuts en direct & Galerie</p>
              <p className="text-[11px] text-stone-400">Voyez qui est en ligne et libre pour un appel.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-stone-900/70 border border-stone-800/80 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Shuffle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-200">Salon Appel au Hasard</p>
              <p className="text-[11px] text-stone-400">Rencontres spontanées avec tarif réduit à la minute.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-stone-900/70 border border-stone-800/80 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-200">Majeurs uniquement (18+)</p>
              <p className="text-[11px] text-stone-400">Vérification de la majorité et sécurité des membres.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Boutons d'action en bas (Mobile-First) */}
      <footer className="relative z-10 w-full space-y-3 pb-4">
        <Link
          href="/register"
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#E05A47] to-[#F59E0B] shadow-lg shadow-red-950/40 hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <span>Créer un compte</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href="/login"
          className="w-full block text-center py-3 px-6 rounded-2xl font-medium text-stone-300 bg-stone-900/80 hover:bg-stone-800/80 border border-stone-800 transition-colors"
        >
          J'ai déjà un compte
        </Link>

        <p className="text-[10px] text-stone-500 text-center pt-2">
          En continuant, vous confirmez avoir au moins 18 ans et acceptez nos conditions.
        </p>
      </footer>
    </main>
  )
}
