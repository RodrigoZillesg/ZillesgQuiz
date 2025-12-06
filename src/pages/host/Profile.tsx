import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, User, Phone, Camera, Lock, Save, Loader2, Check, X } from 'lucide-react'
import { Button, Card, Input } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface ProfileData {
  full_name: string
  whatsapp: string
  avatar_url: string | null
}

export default function Profile() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Dados do perfil
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    whatsapp: '',
    avatar_url: null,
  })

  // Alteração de senha
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)

  // Buscar dados do perfil
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, whatsapp, avatar_url')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setProfile({
          full_name: data.full_name || '',
          whatsapp: data.whatsapp || '',
          avatar_url: data.avatar_url,
        })
      }

      setLoading(false)
    }

    fetchProfile()
  }, [user])

  // Formatar WhatsApp
  const formatWhatsApp = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '')

    // Aplica máscara: (XX) XXXXX-XXXX
    if (numbers.length <= 2) {
      return numbers
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
    }
  }

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value)
    setProfile({ ...profile, whatsapp: formatted })
  }

  // Salvar perfil
  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('user_profiles')
      .update({
        full_name: profile.full_name.trim(),
        whatsapp: profile.whatsapp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar perfil. Tente novamente.' })
    } else {
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' })
    }

    setSaving(false)
  }

  // Upload de avatar
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem deve ter no máximo 2MB.' })
      return
    }

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' })
      return
    }

    setUploadingAvatar(true)
    setMessage(null)

    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`

      // Deletar avatar anterior se existir
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/')
        await supabase.storage.from('avatars').remove([oldPath])
      }

      // Upload do novo avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const avatarUrl = urlData.publicUrl

      // Atualizar perfil com nova URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: avatarUrl })
      setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' })
    } catch (error: any) {
      console.error('Erro no upload:', error)
      setMessage({ type: 'error', text: 'Erro ao enviar foto. Tente novamente.' })
    }

    setUploadingAvatar(false)
  }

  // Alterar senha
  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' })
      return
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' })
      return
    }

    setChangingPassword(true)
    setMessage(null)

    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    })

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao alterar senha. Tente novamente.' })
    } else {
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' })
      setPasswordData({ newPassword: '', confirmPassword: '' })
      setShowPasswordForm(false)
    }

    setChangingPassword(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/host"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </Link>

        <h1 className="text-3xl font-bold font-heading mb-8">Meu Perfil</h1>

        {/* Mensagem de feedback */}
        {message && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-6 ${
              message.type === 'success'
                ? 'bg-success/10 border border-success/20 text-success'
                : 'bg-error/10 border border-error/20 text-error'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* Foto de Perfil */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Camera className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Foto de Perfil</h2>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative">
                <div
                  onClick={handleAvatarClick}
                  className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  ) : profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-text-muted" />
                  )}
                </div>
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:bg-primary/80 transition-colors"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-text-secondary mb-1">Clique para alterar sua foto</p>
                <p className="text-sm text-text-muted">JPG, PNG, WebP ou GIF. Máx. 2MB.</p>
              </div>
            </div>
          </Card>

          {/* Dados Pessoais */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Dados Pessoais</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-muted cursor-not-allowed"
                />
                <p className="text-xs text-text-muted mt-1">
                  O email não pode ser alterado.
                </p>
              </div>

              <Input
                label="Nome Completo"
                placeholder="Seu nome completo"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                maxLength={100}
              />

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={profile.whatsapp}
                  onChange={handleWhatsAppChange}
                  maxLength={15}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <Button onClick={handleSaveProfile} loading={saving}>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </Button>
            </div>
          </Card>

          {/* Alterar Senha */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Segurança</h2>
            </div>

            {!showPasswordForm ? (
              <Button variant="secondary" onClick={() => setShowPasswordForm(true)}>
                <Lock className="w-4 h-4" />
                Alterar Senha
              </Button>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Nova Senha"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                />

                <Input
                  label="Confirmar Nova Senha"
                  type="password"
                  placeholder="Digite novamente a nova senha"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                />

                <div className="flex gap-3">
                  <Button
                    onClick={handleChangePassword}
                    loading={changingPassword}
                    disabled={!passwordData.newPassword || !passwordData.confirmPassword}
                  >
                    <Check className="w-4 h-4" />
                    Confirmar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setPasswordData({ newPassword: '', confirmPassword: '' })
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
