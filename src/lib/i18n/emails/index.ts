export type EmailLang = 'pt' | 'en' | 'es'

const dict = {
  pt: {
    org: 'Organização Missionária',
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
    org: 'Missionary Organization',
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
    org: 'Organización Misionera',
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

// ── E-mail de aprovação (aluno) ─────────────────────────────────────────────
const approvalDict = {
  pt: {
    org: 'Organização Missionária',
    title: 'Parabéns, você foi aceito!',
    greeting: 'Olá, {name}! 🎉',
    body: 'Temos uma ótima notícia: sua inscrição para a <strong style="color:#111827;">{school}</strong> foi analisada e você foi <strong style="color:#16a34a;">aceito(a)</strong> na turma <strong style="color:#111827;">{class}</strong>.',
    infoTitle: 'Informações da turma',
    infoSchool: '🏫 <strong>Escola:</strong> {school}',
    infoClass: '📚 <strong>Turma:</strong> {class}',
    infoStart: '📅 <strong>Início:</strong> {date}',
    nextSteps: 'Em breve você receberá mais informações sobre os próximos passos. Caso tenha dúvidas, responda este e-mail ou entre em contato diretamente.',
    leaderWordTitle: 'Uma palavra da liderança',
    contact: 'Dúvidas? Entre em contato:',
    disclaimer: 'Este e-mail foi enviado automaticamente após sua aprovação.',
    subject: 'Você foi aceito(a) — {school} · {class}',
  },
  en: {
    org: 'Missionary Organization',
    title: 'Congratulations, you’ve been accepted!',
    greeting: 'Hello, {name}! 🎉',
    body: 'Great news: your application for <strong style="color:#111827;">{school}</strong> has been reviewed and you have been <strong style="color:#16a34a;">accepted</strong> into the <strong style="color:#111827;">{class}</strong> class.',
    infoTitle: 'Class information',
    infoSchool: '🏫 <strong>School:</strong> {school}',
    infoClass: '📚 <strong>Class:</strong> {class}',
    infoStart: '📅 <strong>Starts:</strong> {date}',
    nextSteps: 'You will soon receive more information about the next steps. If you have any questions, reply to this email or contact us directly.',
    leaderWordTitle: 'A word from the leadership',
    contact: 'Questions? Contact us:',
    disclaimer: 'This email was sent automatically after your approval.',
    subject: 'You’ve been accepted — {school} · {class}',
  },
  es: {
    org: 'Organización Misionera',
    title: '¡Felicidades, has sido aceptado!',
    greeting: '¡Hola, {name}! 🎉',
    body: 'Tenemos una excelente noticia: tu inscripción para <strong style="color:#111827;">{school}</strong> fue analizada y fuiste <strong style="color:#16a34a;">aceptado(a)</strong> en la clase <strong style="color:#111827;">{class}</strong>.',
    infoTitle: 'Información de la clase',
    infoSchool: '🏫 <strong>Escuela:</strong> {school}',
    infoClass: '📚 <strong>Clase:</strong> {class}',
    infoStart: '📅 <strong>Inicio:</strong> {date}',
    nextSteps: 'Pronto recibirás más información sobre los próximos pasos. Si tienes dudas, responde este correo o contáctanos directamente.',
    leaderWordTitle: 'Una palabra del liderazgo',
    contact: '¿Dudas? Contáctanos:',
    disclaimer: 'Este correo fue enviado automáticamente después de tu aprobación.',
    subject: 'Has sido aceptado(a) — {school} · {class}',
  },
}

// ── E-mail de reprovação (aluno) ────────────────────────────────────────────
const rejectionDict = {
  pt: {
    org: 'Organização Missionária',
    title: 'Atualização sobre sua inscrição',
    greeting: 'Olá, {name}',
    body: 'Sua inscrição para a <strong style="color:#111827;">{school}</strong> foi analisada e, neste momento, <strong style="color:#374151;">não foi aprovada</strong>.',
    leaderWordTitle: 'Uma palavra da liderança',
    contact: 'Dúvidas? Entre em contato:',
    subject: 'Atualização sobre sua inscrição — {school}',
  },
  en: {
    org: 'Missionary Organization',
    title: 'Update on your application',
    greeting: 'Hello, {name}',
    body: 'Your application for <strong style="color:#111827;">{school}</strong> has been reviewed and, at this time, <strong style="color:#374151;">was not approved</strong>.',
    leaderWordTitle: 'A word from the leadership',
    contact: 'Questions? Contact us:',
    subject: 'Update on your application — {school}',
  },
  es: {
    org: 'Organización Misionera',
    title: 'Actualización sobre tu inscripción',
    greeting: 'Hola, {name}',
    body: 'Tu inscripción para <strong style="color:#111827;">{school}</strong> fue analizada y, por el momento, <strong style="color:#374151;">no fue aprobada</strong>.',
    leaderWordTitle: 'Una palabra del liderazgo',
    contact: '¿Dudas? Contáctanos:',
    subject: 'Actualización sobre tu inscripción — {school}',
  },
}

// ── E-mail de aprovação (obreiro) ───────────────────────────────────────────
const staffApprovalDict = {
  pt: {
    title: 'Parabéns, você foi aceito!',
    greeting: 'Olá, {name}! 🎉',
    bodyMinistry: 'Temos uma ótima notícia: sua inscrição como obreiro foi analisada e você foi <strong style="color:#16a34a;">aceito(a)</strong> no ministério <strong style="color:#111827;">{ministry}</strong>. Em breve você receberá mais informações sobre os próximos passos.',
    bodyTeam: 'Temos uma ótima notícia: sua inscrição como obreiro foi analisada e você foi <strong style="color:#16a34a;">aceito(a)</strong> na equipe da <strong style="color:#111827;">{org}</strong>. Em breve você receberá mais informações sobre os próximos passos.',
    leaderWordTitle: 'Uma palavra da liderança',
    contact: 'Dúvidas? Entre em contato:',
    disclaimer: 'Este e-mail foi enviado automaticamente após sua aprovação.',
    subject: 'Você foi aceito(a) como obreiro — {org}',
  },
  en: {
    title: 'Congratulations, you’ve been accepted!',
    greeting: 'Hello, {name}! 🎉',
    bodyMinistry: 'Great news: your staff application has been reviewed and you have been <strong style="color:#16a34a;">accepted</strong> into the <strong style="color:#111827;">{ministry}</strong> ministry. You will soon receive more information about the next steps.',
    bodyTeam: 'Great news: your staff application has been reviewed and you have been <strong style="color:#16a34a;">accepted</strong> onto the <strong style="color:#111827;">{org}</strong> team. You will soon receive more information about the next steps.',
    leaderWordTitle: 'A word from the leadership',
    contact: 'Questions? Contact us:',
    disclaimer: 'This email was sent automatically after your approval.',
    subject: 'You’ve been accepted as staff — {org}',
  },
  es: {
    title: '¡Felicidades, has sido aceptado!',
    greeting: '¡Hola, {name}! 🎉',
    bodyMinistry: 'Tenemos una excelente noticia: tu inscripción como obrero fue analizada y fuiste <strong style="color:#16a34a;">aceptado(a)</strong> en el ministerio <strong style="color:#111827;">{ministry}</strong>. Pronto recibirás más información sobre los próximos pasos.',
    bodyTeam: 'Tenemos una excelente noticia: tu inscripción como obrero fue analizada y fuiste <strong style="color:#16a34a;">aceptado(a)</strong> en el equipo de <strong style="color:#111827;">{org}</strong>. Pronto recibirás más información sobre los próximos pasos.',
    leaderWordTitle: 'Una palabra del liderazgo',
    contact: '¿Dudas? Contáctanos:',
    disclaimer: 'Este correo fue enviado automáticamente después de tu aprobación.',
    subject: 'Has sido aceptado(a) como obrero — {org}',
  },
}

export function getApprovalDict(lang: EmailLang) { return approvalDict[lang] }
export function getRejectionDict(lang: EmailLang) { return rejectionDict[lang] }
export function getStaffApprovalDict(lang: EmailLang) { return staffApprovalDict[lang] }
