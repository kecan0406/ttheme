import { Landing } from '@/components/landing'
import { loadManifest } from '@/lib/themes'

export default function Page() {
  const { version, gate, themes } = loadManifest()

  return <Landing themes={themes} gate={gate} version={version} />
}
