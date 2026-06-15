export type EmailLang = 'pt' | 'en' | 'es'

const dict = {
  pt: {
    org: 'Jovens Com Uma Missão',
    subtitle: 'Formulário de Inscrição',
    greeting: 'Olá, {name}! 👋',
    body: 'Seu formulário de inscrição para a <strong style="color:#111827;">{school}</strong> está disponível. Clique no botão abaixo para acessá-lo e preencher com atenção.',
    cta: 'Acessar meu formulário →',
    infoTitle: 'Informações importantes',
    validity: '⏰ <strong>Validade do link:</strong> {date}',
    time: '📝 <strong>Tempo estimado:</strong> 30 a 45 minutos',
    progress: '💾 <strong>Progresso salvo:</strong> Você pode pausar e continuar depois.',
    fallback: 'Se o botão acima não funcionar, copie e cole este link no seu navegador:',
    contact: 'Dúvidas? Entre em contato:',
    disclaimer: 'Este e-mail foi enviado automaticamente. O preenchimento do formulário não garante aceitação.',
  },
  en: {
    org: 'Youth With A Mission',
    subtitle: 'Application Form',
    greeting: 'Hello, {name}! 👋',
    body: 'Your application form for <strong style="color:#111827;">{school}</strong> is ready. Click the button below to access and complete it carefully.',
    cta: 'Access my form →',
    infoTitle: 'Important information',
    validity: '⏰ <strong>Link expires:</strong> {date}',
    time: '📝 <strong>Estimated time:</strong> 30 to 45 minutes',
    progress: '💾 <strong>Progress saved:</strong> You can pause and continue later.',
    fallback: 'If the button above does not work, copy and paste this link into your browser:',
    contact: 'Questions? Contact us:',
    disclaimer: 'This email was sent automatically. Completing the form does not guarantee acceptance.',
  },
  es: {
    org: 'Jóvenes Con Una Misión',
    subtitle: 'Formulario de Inscripción',
    greeting: '¡Hola, {name}! 👋',
    body: 'Tu formulario de inscripción para <strong style="color:#111827;">{school}</strong> está disponible. Haz clic en el botón de abajo para acceder y completarlo con atención.',
    cta: 'Acceder a mi formulario →',
    infoTitle: 'Información importante',
    validity: '⏰ <strong>Validez del enlace:</strong> {date}',
    time: '📝 <strong>Tiempo estimado:</strong> 30 a 45 minutos',
    progress: '💾 <strong>Progreso guardado:</strong> Puedes pausar y continuar después.',
    fallback: 'Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:',
    contact: '¿Dudas? Contáctanos:',
    disclaimer: 'Este correo fue enviado automáticamente. Completar el formulario no garantiza la aceptación.',
  },
}

const localeMap: Record<EmailLang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es' }

export function getEmailDict(lang: EmailLang) { return dict[lang] }
export function emailLocale(lang: EmailLang) { return localeMap[lang] }
