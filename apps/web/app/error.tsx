"use client"
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <section className="p-8" role="alert"><h1 className="text-xl font-semibold">Não foi possível abrir esta tela</h1><p className="my-4">Tente novamente. Seus dados salvos continuam preservados.</p><button type="button" className="rounded border px-4 py-2" onClick={reset}>Tentar novamente</button></section>
}
