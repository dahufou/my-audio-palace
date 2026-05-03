import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  DEFAULT_EQ_BANDS,
  EQ_PRESETS,
  useSettings,
  type Settings,
} from "@/lib/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  Volume2,
  Sliders,
  Music2,
  Wifi,
  HardDrive,
  Palette,
  Plug,
  Bell,
  Shield,
  Info,
  RotateCcw,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { getAurumBase } from "@/lib/aurum";
import { clearHistory } from "@/lib/listeningHistory";
import { clearAllPositions } from "@/lib/positions";

const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-6 py-3">
    <div className="min-w-0">
      <div className="text-sm font-medium">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Section = ({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) => (
  <Card className="p-6 bg-card/60 border-border/60">
    <div className="mb-4">
      <h3 className="font-display text-xl">{title}</h3>
      {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
    </div>
    <div className="divide-y divide-border/50">{children}</div>
  </Card>
);

export default function SettingsPage() {
  const { settings, update, reset, exportJson, importJson } = useSettings();
  const [importText, setImportText] = useState("");

  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update(k, v);

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aurum-settings.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Paramètres exportés");
  };

  const handleImport = () => {
    try {
      importJson(importText);
      setImportText("");
      toast.success("Paramètres importés");
    } catch {
      toast.error("JSON invalide");
    }
  };

  const applyEqPreset = (name: string) => {
    const gains = EQ_PRESETS[name];
    if (!gains) return;
    update("equalizerPreset", name);
    update(
      "equalizerBands",
      DEFAULT_EQ_BANDS.map((b, i) => ({ ...b, gain: gains[i] ?? 0 })),
    );
  };

  const updateBand = (i: number, gain: number) => {
    const next = settings.equalizerBands.map((b, idx) => (idx === i ? { ...b, gain } : b));
    update("equalizerBands", next);
    update("equalizerPreset", "Custom");
  };

  return (
    <AppLayout>
      <div className="px-6 lg:px-12 py-10 max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary mb-2">
            Préférences
          </div>
          <h1 className="font-display text-5xl">Paramètres</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Réglez le moteur audio, la qualité, l'apparence et les intégrations d'Aurum
            avec une précision audiophile.
          </p>
        </header>

        <Tabs defaultValue="audio" className="w-full">
          <TabsList className="flex-wrap h-auto bg-card/60 border border-border/60 p-1">
            <TabsTrigger value="audio" className="gap-2">
              <Volume2 className="h-3.5 w-3.5" /> Audio
            </TabsTrigger>
            <TabsTrigger value="eq" className="gap-2">
              <Sliders className="h-3.5 w-3.5" /> Égaliseur
            </TabsTrigger>
            <TabsTrigger value="playback" className="gap-2">
              <Music2 className="h-3.5 w-3.5" /> Lecture
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-2">
              <Wifi className="h-3.5 w-3.5" /> Qualité
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2">
              <HardDrive className="h-3.5 w-3.5" /> Bibliothèque
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-3.5 w-3.5" /> Apparence
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Plug className="h-3.5 w-3.5" /> Intégrations
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="gap-2">
              <Bell className="h-3.5 w-3.5" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="h-3.5 w-3.5" /> Confidentialité
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-2">
              <Info className="h-3.5 w-3.5" /> À propos
            </TabsTrigger>
          </TabsList>

          {/* AUDIO ENGINE */}
          <TabsContent value="audio" className="mt-6 space-y-6">
            <Section title="Moteur audio" desc="Sortie, format et latence du flux numérique.">
              <Row label="Périphérique de sortie" hint="System default suit la plupart des cas.">
                <Input
                  className="w-72"
                  value={settings.outputDevice}
                  onChange={(e) => set("outputDevice")(e.target.value)}
                />
              </Row>
              <Row label="Mode exclusif" hint="Bypass du mixeur OS pour une sortie bit-perfect.">
                <Switch checked={settings.exclusiveMode} onCheckedChange={set("exclusiveMode")} />
              </Row>
              <Row label="Bit-perfect" hint="Aucune transformation entre fichier et DAC.">
                <Switch checked={settings.bitPerfect} onCheckedChange={set("bitPerfect")} />
              </Row>
              <Row label="Fréquence d'échantillonnage">
                <Select value={settings.sampleRate} onValueChange={(v) => set("sampleRate")(v as Settings["sampleRate"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (suivre source)</SelectItem>
                    <SelectItem value="44100">44.1 kHz</SelectItem>
                    <SelectItem value="48000">48 kHz</SelectItem>
                    <SelectItem value="88200">88.2 kHz</SelectItem>
                    <SelectItem value="96000">96 kHz</SelectItem>
                    <SelectItem value="176400">176.4 kHz</SelectItem>
                    <SelectItem value="192000">192 kHz</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Profondeur de bits">
                <Select value={settings.bitDepth} onValueChange={(v) => set("bitDepth")(v as Settings["bitDepth"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="16">16-bit</SelectItem>
                    <SelectItem value="24">24-bit</SelectItem>
                    <SelectItem value="32">32-bit float</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Dithering" hint="Réduit les artefacts en réduction de profondeur.">
                <Switch checked={settings.dithering} onCheckedChange={set("dithering")} />
              </Row>
              <Row label="Upsampling" hint="Suréchantillonne au format max du DAC.">
                <Switch checked={settings.upsampling} onCheckedChange={set("upsampling")} />
              </Row>
              <Row label={`Tampon de sortie (${settings.outputBufferMs} ms)`} hint="Plus haut = stable, plus bas = réactif.">
                <div className="w-56">
                  <Slider
                    value={[settings.outputBufferMs]}
                    min={20}
                    max={500}
                    step={10}
                    onValueChange={([v]) => set("outputBufferMs")(v)}
                  />
                </div>
              </Row>
              <Row label="Pré-charger le titre suivant">
                <Switch checked={settings.preloadNext} onCheckedChange={set("preloadNext")} />
              </Row>
            </Section>

            <Section title="Volume & dynamique">
              <Row label={`Volume principal (${Math.round(settings.masterVolume * 100)}%)`}>
                <div className="w-56">
                  <Slider
                    value={[settings.masterVolume * 100]}
                    min={0}
                    max={100}
                    onValueChange={([v]) => set("masterVolume")(v / 100)}
                  />
                </div>
              </Row>
              <Row label="Normalisation du volume">
                <Switch checked={settings.volumeNormalization} onCheckedChange={set("volumeNormalization")} />
              </Row>
              <Row label="ReplayGain">
                <Select value={settings.replayGain} onValueChange={(v) => set("replayGain")(v as Settings["replayGain"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Désactivé</SelectItem>
                    <SelectItem value="track">Par piste</SelectItem>
                    <SelectItem value="album">Par album</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label={`Préamp (${settings.preampDb > 0 ? "+" : ""}${settings.preampDb} dB)`}>
                <div className="w-56">
                  <Slider value={[settings.preampDb]} min={-12} max={12} step={0.5} onValueChange={([v]) => set("preampDb")(v)} />
                </div>
              </Row>
              <Row label="Limiteur" hint="Évite l'écrêtage numérique.">
                <Switch checked={settings.limiter} onCheckedChange={set("limiter")} />
              </Row>
              <Row label="Downmix mono">
                <Switch checked={settings.monoDownmix} onCheckedChange={set("monoDownmix")} />
              </Row>
              <Row label={`Balance (${settings.channelBalance === 0 ? "centre" : settings.channelBalance < 0 ? `G ${Math.abs(settings.channelBalance * 100).toFixed(0)}%` : `D ${(settings.channelBalance * 100).toFixed(0)}%`})`}>
                <div className="w-56">
                  <Slider value={[settings.channelBalance]} min={-1} max={1} step={0.05} onValueChange={([v]) => set("channelBalance")(v)} />
                </div>
              </Row>
            </Section>
          </TabsContent>

          {/* EQUALIZER */}
          <TabsContent value="eq" className="mt-6 space-y-6">
            <Section title="Égaliseur 10 bandes" desc="Ajustement fin par fréquence (dB).">
              <Row label="Activer l'égaliseur">
                <Switch checked={settings.equalizerEnabled} onCheckedChange={set("equalizerEnabled")} />
              </Row>
              <Row label="Préréglage">
                <Select value={settings.equalizerPreset} onValueChange={applyEqPreset}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(EQ_PRESETS).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="Custom">Personnalisé</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <div className="pt-6">
                <div className="flex items-end gap-4 justify-between px-2">
                  {settings.equalizerBands.map((b, i) => (
                    <div key={b.hz} className="flex flex-col items-center gap-2 flex-1">
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {b.gain > 0 ? "+" : ""}{b.gain.toFixed(1)}
                      </div>
                      <div className="h-40 flex items-center">
                        <Slider
                          orientation="vertical"
                          value={[b.gain]}
                          min={-12}
                          max={12}
                          step={0.5}
                          onValueChange={([v]) => updateBand(i, v)}
                          className="h-40"
                        />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {b.hz >= 1000 ? `${b.hz / 1000}k` : b.hz}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => applyEqPreset("Flat")}>
                    Réinitialiser à plat
                  </Button>
                </div>
              </div>
            </Section>
          </TabsContent>

          {/* PLAYBACK */}
          <TabsContent value="playback" className="mt-6 space-y-6">
            <Section title="Lecture">
              <Row label="Lecture sans coupure (gapless)">
                <Switch checked={settings.gaplessPlayback} onCheckedChange={set("gaplessPlayback")} />
              </Row>
              <Row label="Crossfade">
                <Switch checked={settings.crossfadeEnabled} onCheckedChange={set("crossfadeEnabled")} />
              </Row>
              <Row label={`Durée crossfade (${settings.crossfadeMs / 1000}s)`}>
                <div className="w-56">
                  <Slider
                    value={[settings.crossfadeMs]}
                    min={0}
                    max={12000}
                    step={500}
                    onValueChange={([v]) => set("crossfadeMs")(v)}
                    disabled={!settings.crossfadeEnabled}
                  />
                </div>
              </Row>
              <Row label="Forme du crossfade">
                <Select value={settings.crossfadeShape} onValueChange={(v) => set("crossfadeShape")(v as Settings["crossfadeShape"])}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linéaire</SelectItem>
                    <SelectItem value="equal-power">Equal-power</SelectItem>
                    <SelectItem value="logarithmic">Logarithmique</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Couper les silences en début/fin">
                <Switch checked={settings.silenceTrim} onCheckedChange={set("silenceTrim")} />
              </Row>
              <Row label={`Fade-in (${settings.fadeInMs} ms)`}>
                <div className="w-56">
                  <Slider value={[settings.fadeInMs]} min={0} max={3000} step={50} onValueChange={([v]) => set("fadeInMs")(v)} />
                </div>
              </Row>
              <Row label={`Fade-out (${settings.fadeOutMs} ms)`}>
                <div className="w-56">
                  <Slider value={[settings.fadeOutMs]} min={0} max={3000} step={50} onValueChange={([v]) => set("fadeOutMs")(v)} />
                </div>
              </Row>
              <Row label="Reprendre la lecture à la position précédente">
                <Switch checked={settings.rememberPosition} onCheckedChange={set("rememberPosition")} />
              </Row>
              <Row label="Lecture auto au démarrage">
                <Switch checked={settings.autoPlay} onCheckedChange={set("autoPlay")} />
              </Row>
              <Row label="Radio auto en fin de file">
                <Switch checked={settings.autoPlayRadioWhenQueueEnds} onCheckedChange={set("autoPlayRadioWhenQueueEnds")} />
              </Row>
              <Row label={`Ignorer titres < ${settings.skipShortTracksSec}s`} hint="0 = désactivé">
                <div className="w-56">
                  <Slider value={[settings.skipShortTracksSec]} min={0} max={60} step={1} onValueChange={([v]) => set("skipShortTracksSec")(v)} />
                </div>
              </Row>
              <Row label="Répétition par défaut">
                <Select value={settings.defaultRepeat} onValueChange={(v) => set("defaultRepeat")(v as Settings["defaultRepeat"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Désactivée</SelectItem>
                    <SelectItem value="all">Toute la file</SelectItem>
                    <SelectItem value="one">Titre unique</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Lecture aléatoire par défaut">
                <Switch checked={settings.defaultShuffle} onCheckedChange={set("defaultShuffle")} />
              </Row>
            </Section>
          </TabsContent>

          {/* QUALITY */}
          <TabsContent value="quality" className="mt-6 space-y-6">
            <Section title="Qualité de streaming">
              <Row label="Qualité Wi-Fi">
                <Select value={settings.streamQualityWifi} onValueChange={(v) => set("streamQualityWifi")(v as Settings["streamQualityWifi"])}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="lossless">Lossless (FLAC)</SelectItem>
                    <SelectItem value="high">Haute (320 kbps)</SelectItem>
                    <SelectItem value="normal">Normale (192 kbps)</SelectItem>
                    <SelectItem value="low">Basse (96 kbps)</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Qualité 4G/5G">
                <Select value={settings.streamQualityCellular} onValueChange={(v) => set("streamQualityCellular")(v as Settings["streamQualityCellular"])}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="lossless">Lossless</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="low">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Qualité de téléchargement">
                <Select value={settings.downloadQuality} onValueChange={(v) => set("downloadQuality")(v as Settings["downloadQuality"])}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="lossless">Lossless</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Téléchargements en Wi-Fi uniquement">
                <Switch checked={settings.downloadOnWifiOnly} onCheckedChange={set("downloadOnWifiOnly")} />
              </Row>
              <Row label={`Cache local max (${settings.maxCacheGb} Go)`}>
                <div className="w-56">
                  <Slider value={[settings.maxCacheGb]} min={0} max={200} step={1} onValueChange={([v]) => set("maxCacheGb")(v)} />
                </div>
              </Row>
              <Row label="Vider le cache local" hint="Efface positions de lecture mémorisées et caches navigateur Aurum.">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    clearAllPositions();
                    try {
                      if ("caches" in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map((k) => caches.delete(k)));
                      }
                    } catch {}
                    toast.success("Cache vidé");
                  }}
                >
                  Effacer
                </Button>
              </Row>
            </Section>
          </TabsContent>

          {/* LIBRARY */}
          <TabsContent value="library" className="mt-6 space-y-6">
            <Section title="Bibliothèque">
              <Row label="Chemin musique (serveur)">
                <Input className="w-72" value={settings.musicPath} onChange={(e) => set("musicPath")(e.target.value)} />
              </Row>
              <Row label="Surveillance du dossier">
                <Switch checked={settings.watchFolder} onCheckedChange={set("watchFolder")} />
              </Row>
              <Row label="Scan au démarrage">
                <Switch checked={settings.scanOnStartup} onCheckedChange={set("scanOnStartup")} />
              </Row>
              <Row label="Ignorer fichiers cachés">
                <Switch checked={settings.ignoreHiddenFiles} onCheckedChange={set("ignoreHiddenFiles")} />
              </Row>
              <Row label="Grouper les compilations">
                <Switch checked={settings.groupCompilations} onCheckedChange={set("groupCompilations")} />
              </Row>
              <Row label="Préférer pochettes embarquées">
                <Switch checked={settings.preferEmbeddedArt} onCheckedChange={set("preferEmbeddedArt")} />
              </Row>
              <Row label="Récupérer métadonnées externes">
                <Switch checked={settings.fetchExternalMetadata} onCheckedChange={set("fetchExternalMetadata")} />
              </Row>
              <Row label={`Taille pochettes (${settings.preferredCoverSizePx}px)`}>
                <div className="w-56">
                  <Slider value={[settings.preferredCoverSizePx]} min={200} max={1200} step={50} onValueChange={([v]) => set("preferredCoverSizePx")(v)} />
                </div>
              </Row>
              <Row label="Tri albums par défaut">
                <Select value={settings.defaultAlbumSort} onValueChange={(v) => set("defaultAlbumSort")(v as Settings["defaultAlbumSort"])}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">Titre</SelectItem>
                    <SelectItem value="artist">Artiste</SelectItem>
                    <SelectItem value="year-desc">Année (récent)</SelectItem>
                    <SelectItem value="year-asc">Année (ancien)</SelectItem>
                    <SelectItem value="added">Date d'ajout</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Tri artistes par défaut">
                <Select value={settings.defaultArtistSort} onValueChange={(v) => set("defaultArtistSort")(v as Settings["defaultArtistSort"])}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nom</SelectItem>
                    <SelectItem value="albums-count">Nb albums</SelectItem>
                    <SelectItem value="tracks-count">Nb titres</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Vue par défaut">
                <Select value={settings.defaultLibraryView} onValueChange={(v) => set("defaultLibraryView")(v as Settings["defaultLibraryView"])}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grille</SelectItem>
                    <SelectItem value="list">Liste</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Lancer un re-scan complet" hint="Déclenche un scan côté serveur Aurum.">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${getAurumBase()}/library/scan`, {
                        method: "POST",
                      });
                      if (res.status === 401) {
                        toast.error("Scan refusé : token requis côté serveur.");
                        return;
                      }
                      if (!res.ok) throw new Error(String(res.status));
                      toast.success("Scan démarré");
                    } catch (err) {
                      toast.error("Échec du scan");
                    }
                  }}
                >
                  Scanner maintenant
                </Button>
              </Row>
            </Section>

            <Section title="Réseau">
              <Row label="URL du serveur Aurum">
                <Input className="w-72" value={settings.aurumBaseUrl} onChange={(e) => set("aurumBaseUrl")(e.target.value)} />
              </Row>
              <Row label="Forcer HTTPS">
                <Switch checked={settings.enforceHttps} onCheckedChange={set("enforceHttps")} />
              </Row>
              <Row label={`Timeout connexion (${settings.connectTimeoutMs} ms)`}>
                <div className="w-56">
                  <Slider value={[settings.connectTimeoutMs]} min={1000} max={30000} step={500} onValueChange={([v]) => set("connectTimeoutMs")(v)} />
                </div>
              </Row>
              <Row label={`Tentatives de reconnexion (${settings.retryCount})`}>
                <div className="w-56">
                  <Slider value={[settings.retryCount]} min={0} max={10} step={1} onValueChange={([v]) => set("retryCount")(v)} />
                </div>
              </Row>
            </Section>
          </TabsContent>

          {/* APPEARANCE */}
          <TabsContent value="appearance" className="mt-6 space-y-6">
            <Section title="Apparence">
              <Row label="Thème">
                <Select value={settings.theme} onValueChange={(v) => set("theme")(v as Settings["theme"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Sombre</SelectItem>
                    <SelectItem value="light">Clair</SelectItem>
                    <SelectItem value="system">Système</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Couleur d'accent">
                <Select value={settings.accentColor} onValueChange={(v) => set("accentColor")(v as Settings["accentColor"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Or</SelectItem>
                    <SelectItem value="indigo">Indigo</SelectItem>
                    <SelectItem value="emerald">Émeraude</SelectItem>
                    <SelectItem value="crimson">Cramoisi</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Densité">
                <Select value={settings.density} onValueChange={(v) => set("density")(v as Settings["density"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Confortable</SelectItem>
                    <SelectItem value="compact">Compacte</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Forme des pochettes">
                <Select value={settings.coverShape} onValueChange={(v) => set("coverShape")(v as Settings["coverShape"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Carrée</SelectItem>
                    <SelectItem value="rounded">Arrondie</SelectItem>
                    <SelectItem value="circle">Cercle (artistes)</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Analyseur de spectre">
                <Switch checked={settings.showSpectrumAnalyzer} onCheckedChange={set("showSpectrumAnalyzer")} />
              </Row>
              <Row label="Réduire les animations">
                <Switch checked={settings.reducedMotion} onCheckedChange={set("reducedMotion")} />
              </Row>
              <Row label={`Échelle de police (${Math.round(settings.fontScale * 100)}%)`}>
                <div className="w-56">
                  <Slider value={[settings.fontScale * 100]} min={85} max={125} step={5} onValueChange={([v]) => set("fontScale")(v / 100)} />
                </div>
              </Row>
              <Row label="Langue">
                <Select value={settings.language} onValueChange={(v) => set("language")(v as Settings["language"])}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="system">Système</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </Section>
          </TabsContent>

          {/* INTEGRATIONS */}
          <TabsContent value="integrations" className="mt-6 space-y-6">
            <Section title="Services">
              <Row label="Scrobble Last.fm">
                <Switch checked={settings.scrobbleLastFm} onCheckedChange={set("scrobbleLastFm")} />
              </Row>
              <Row label="Utilisateur Last.fm">
                <Input className="w-64" value={settings.lastFmUser} onChange={(e) => set("lastFmUser")(e.target.value)} disabled={!settings.scrobbleLastFm} />
              </Row>
              <Row label="Discord Rich Presence">
                <Switch checked={settings.discordRichPresence} onCheckedChange={set("discordRichPresence")} />
              </Row>
              <Row label="Diffusion Chromecast">
                <Switch checked={settings.publishToCast} onCheckedChange={set("publishToCast")} />
              </Row>
              <Row label="Activer UPnP/DLNA">
                <Switch checked={settings.enableUpnp} onCheckedChange={set("enableUpnp")} />
              </Row>
            </Section>
          </TabsContent>

          {/* NOTIFICATIONS / SHORTCUTS */}
          <TabsContent value="shortcuts" className="mt-6 space-y-6">
            <Section title="Notifications">
              <Row label="Notifications système" hint="Demande la permission au navigateur si nécessaire.">
                <Switch
                  checked={settings.showOsNotifications}
                  onCheckedChange={async (v) => {
                    set("showOsNotifications")(v);
                    if (v && "Notification" in window && Notification.permission === "default") {
                      const res = await Notification.requestPermission();
                      if (res !== "granted") {
                        toast.error("Permission refusée par le navigateur");
                        set("showOsNotifications")(false);
                      } else {
                        toast.success("Notifications activées");
                      }
                    }
                  }}
                />
              </Row>
              <Row label="Notifier au changement de titre">
                <Switch checked={settings.notifyOnTrackChange} onCheckedChange={set("notifyOnTrackChange")} />
              </Row>
              <Row label="Touches média du clavier" hint="Play/pause/next/prev sur clavier multimédia ou Bluetooth.">
                <Switch checked={settings.mediaKeysEnabled} onCheckedChange={set("mediaKeysEnabled")} />
              </Row>
            </Section>
            <Section title="Raccourcis clavier">
              <Row label="Lecture / Pause">
                <Input className="w-40" value={settings.hotkeyPlayPause} onChange={(e) => set("hotkeyPlayPause")(e.target.value)} />
              </Row>
              <Row label="Titre suivant">
                <Input className="w-40" value={settings.hotkeyNext} onChange={(e) => set("hotkeyNext")(e.target.value)} />
              </Row>
              <Row label="Titre précédent">
                <Input className="w-40" value={settings.hotkeyPrev} onChange={(e) => set("hotkeyPrev")(e.target.value)} />
              </Row>
              <Row label="Volume +">
                <Input className="w-40" value={settings.hotkeyVolumeUp} onChange={(e) => set("hotkeyVolumeUp")(e.target.value)} />
              </Row>
              <Row label="Volume -">
                <Input className="w-40" value={settings.hotkeyVolumeDown} onChange={(e) => set("hotkeyVolumeDown")(e.target.value)} />
              </Row>
            </Section>
          </TabsContent>

          {/* PRIVACY */}
          <TabsContent value="privacy" className="mt-6 space-y-6">
            <Section title="Confidentialité">
              <Row label="Statistiques d'utilisation anonymes">
                <Switch checked={settings.analyticsEnabled} onCheckedChange={set("analyticsEnabled")} />
              </Row>
              <Row label="Rapports de plantage">
                <Switch checked={settings.crashReports} onCheckedChange={set("crashReports")} />
              </Row>
              <Row label="Conserver l'historique d'écoute">
                <Switch checked={settings.saveListeningHistory} onCheckedChange={set("saveListeningHistory")} />
              </Row>
              <Row label="Effacer l'historique d'écoute">
                <Button variant="outline" size="sm" onClick={() => { clearHistory(); toast.success("Historique effacé"); }}>
                  Effacer
                </Button>
              </Row>
            </Section>

            <Section title="Sauvegarde / Restauration">
              <Row label="Exporter tous les paramètres" hint="Génère un fichier JSON.">
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                  <Download className="h-3.5 w-3.5" /> Exporter
                </Button>
              </Row>
              <div className="py-3 space-y-2">
                <Label className="text-sm">Importer depuis JSON</Label>
                <textarea
                  className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  placeholder='{"masterVolume": 0.8, ...}'
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleImport} className="gap-2" disabled={!importText.trim()}>
                    <Upload className="h-3.5 w-3.5" /> Importer
                  </Button>
                </div>
              </div>
              <Row label="Réinitialiser tous les paramètres" hint="Restaure les valeurs par défaut.">
                <Button variant="destructive" size="sm" onClick={() => { reset(); toast.success("Paramètres réinitialisés"); }} className="gap-2">
                  <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
                </Button>
              </Row>
            </Section>
          </TabsContent>

          {/* ABOUT */}
          <TabsContent value="about" className="mt-6 space-y-6">
            <Section title="À propos d'Aurum">
              <Row label="Version">
                <span className="text-sm text-muted-foreground tabular-nums">1.0.0-beta</span>
              </Row>
              <Row label="Build">
                <span className="text-sm text-muted-foreground tabular-nums">{new Date().toISOString().slice(0, 10)}</span>
              </Row>
              <Row label="Moteur">
                <span className="text-sm text-muted-foreground">Web Audio · HTMLMediaElement</span>
              </Row>
              <Row label="Serveur connecté">
                <span className="text-sm text-muted-foreground">{settings.aurumBaseUrl}</span>
              </Row>
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                Aurum — lecteur audiophile éditorial. Conçu pour la haute fidélité,
                pensé pour la collection.
              </p>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
