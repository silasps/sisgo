'use client'

import { useState } from 'react'

type ProviderGuide = {
  name: string
  status: string
  customerHint: string
  links: Array<{ label: string; href: string }>
}

const providerGuides: Record<string, ProviderGuide> = {
  asaas: {
    name: 'Asaas',
    status: 'Gera Pix automático agora',
    customerHint: 'No Asaas, crie um cliente como “Consumidor de refeições SISGO” e cole aqui o ID retornado.',
    links: [
      { label: 'Criar cliente', href: 'https://docs.asaas.com/docs/criando-um-cliente' },
      { label: 'Criar cobrança Pix', href: 'https://docs.asaas.com/reference/create-new-payment' },
      { label: 'Obter QR Code Pix', href: 'https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix' },
    ],
  },
  mercado_pago: {
    name: 'Mercado Pago',
    status: 'Gera Pix automático agora',
    customerHint: 'No Mercado Pago, use aqui um e-mail pagador padrão para criar pagamentos Pix.',
    links: [
      { label: 'Pix no Checkout Transparente', href: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-api-v2/payment-integration/pix' },
      { label: 'Criar pagamento Pix', href: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix' },
      { label: 'QR Code dinâmico', href: 'https://www.mercadopago.com.br/developers/en/docs/qr-code/payment-processing' },
    ],
  },
  pagseguro: {
    name: 'PagBank',
    status: 'Gera Pix automático agora',
    customerHint: 'No PagBank, use aqui um identificador/nome padrão do consumidor para os pedidos de refeição.',
    links: [
      { label: 'Criar pedido com QR Code Pix', href: 'https://developer.pagbank.com.br/reference/criar-pedido-pedido-com-qr-code' },
      { label: 'Criar pedido', href: 'https://developer.pagbank.com.br/reference/criar-pedido' },
      { label: 'Portal de desenvolvedores', href: 'https://developer.pagbank.com.br/' },
    ],
  },
  efi: {
    name: 'Efí / Gerencianet',
    status: 'Precisa de certificado Pix/mTLS antes de liberar',
    customerHint: 'Na Efí, a integração Pix costuma exigir Client ID, Client Secret, escopos Pix e certificado. Use este campo para identificar a aplicação enquanto configuramos o certificado.',
    links: [
      { label: 'Endpoints Pix Efí', href: 'https://gerencianet.github.io/documentation/docs/PIX/Endpoints/' },
      { label: 'Criar cobrança imediata', href: 'https://gerencianet.github.io/documentation/docs/PIX/Endpoints/#creating-instant-charges-without-txid' },
      { label: 'Documentação Efí', href: 'https://dev.efipay.com.br/' },
    ],
  },
}

type Props = {
  action: (formData: FormData) => void
  paymentMethods: string[]
  paymentInstructions: string
  paymentProvider: string
  gatewayConfigured: boolean
  gatewayRequested: boolean
  gatewayWebhookToken: string
  gatewayWebhookUrl: string
  currentBaseUrl: string
  gatewayPublicBaseUrl: string
  gatewayCnpj: string
  gatewayLegalName: string
  gatewayPixKeyType: string
  gatewayPixKey: string
  gatewayEnvironment: string
  gatewayProviderAccountId: string
  gatewayDefaultCustomerId: string
  accessTokenConfigured: boolean
}

export function MealPaymentSettingsForm(props: Props) {
  const [pixEnabled, setPixEnabled] = useState(props.gatewayRequested)
  const [provider, setProvider] = useState(props.paymentProvider)
  const [pixKeyType, setPixKeyType] = useState(props.gatewayPixKeyType)
  const [publicBaseUrl, setPublicBaseUrl] = useState(props.gatewayPublicBaseUrl)
  const providerHasAutomaticPix = ['asaas', 'mercado_pago', 'pagseguro'].includes(provider)
  const providerGuide = providerGuides[provider]
  const effectivePaymentMethods = props.paymentMethods.filter(method => method !== 'gateway' || props.gatewayConfigured)
  const displayBaseUrl = (publicBaseUrl || props.currentBaseUrl).replace(/\/+$/, '')
  const webhookUrl = `${displayBaseUrl}/api/payments/kitchen-meals/webhook`
  const usingLocalhostWebhook = /localhost|127\.0\.0\.1/.test(displayBaseUrl)

  return (
    <form action={props.action} className="space-y-4 bg-gray-50 p-4">
      {pixEnabled && !props.gatewayConfigured && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Pix automático está pendente de configuração. Complete os dados do provedor para o SISGO gerar o Pix com o valor da compra.
          {provider === 'efi' && (
            <span className="mt-1 block">
              A Efí/Gerencianet ainda precisa de certificado Pix/mTLS antes de liberar a geração automática.
            </span>
          )}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <input name="payment_methods" type="checkbox" value="manual" defaultChecked={effectivePaymentMethods.includes('manual')}
            className="mr-2 h-4 w-4 rounded border-gray-300 text-brand-500" />
          Manual pela secretaria
          <span className="mt-1 block text-xs text-gray-400">A secretaria confere o pagamento e confirma.</span>
        </label>
        <label className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <input name="payment_methods" type="checkbox" value="proof" defaultChecked={effectivePaymentMethods.includes('proof')}
            className="mr-2 h-4 w-4 rounded border-gray-300 text-brand-500" />
          Com comprovante
          <span className="mt-1 block text-xs text-gray-400">Pedido aguarda análise do comprovante.</span>
        </label>
        <label className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <input name="payment_methods" type="checkbox" value="gateway" checked={pixEnabled}
            onChange={(event) => setPixEnabled(event.target.checked)}
            className="mr-2 h-4 w-4 rounded border-gray-300 text-brand-500" />
          Pix automático
          <span className="mt-1 block text-xs text-gray-400">
            {props.gatewayConfigured
              ? 'Gateway configurado para confirmação automática.'
              : 'Marque para abrir a configuração do provedor.'}
          </span>
        </label>
      </div>

      <textarea name="payment_instructions" rows={3} defaultValue={props.paymentInstructions}
        placeholder="Instruções para a pessoa: chave Pix, enviar comprovante, horários de conferência..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />

      {!pixEnabled && (
        <HiddenGatewayFields
          paymentProvider={provider}
          gatewayCnpj={props.gatewayCnpj}
          gatewayLegalName={props.gatewayLegalName}
          gatewayPixKeyType={props.gatewayPixKeyType}
          gatewayPixKey={props.gatewayPixKey}
          gatewayEnvironment={props.gatewayEnvironment}
          gatewayProviderAccountId={props.gatewayProviderAccountId}
          gatewayDefaultCustomerId={props.gatewayDefaultCustomerId}
          gatewayPublicBaseUrl={props.gatewayPublicBaseUrl}
          gatewayWebhookToken={props.gatewayWebhookToken}
        />
      )}

      {pixEnabled && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Dados para Pix automático</h3>
              <p className="text-xs text-gray-400">Quando estiver completo, o sistema gera o Pix com o valor exato da compra e aguarda a confirmação automática.</p>
            </div>
            <span className={props.gatewayConfigured
              ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
              : 'rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700'}>
              {props.gatewayConfigured ? 'Gateway configurado' : 'Configuração incompleta'}
            </span>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-[16rem_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Provedor</span>
              <select name="payment_provider" value={provider} onChange={(event) => setProvider(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">Selecione</option>
                <option value="asaas">Asaas - gera Pix automático</option>
                <option value="efi">Efí / Gerencianet - exige certificado Pix</option>
                <option value="mercado_pago">Mercado Pago - gera Pix automático</option>
                <option value="pagseguro">PagBank - gera Pix automático</option>
                <option value="outro">Outro provedor</option>
              </select>
            </label>
            <ProviderGuide guide={providerGuide} providerHasAutomaticPix={providerHasAutomaticPix} provider={provider} />
          </div>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <SetupStep done={Boolean(provider)} label="Escolher provedor" />
            <SetupStep done={Boolean(props.gatewayCnpj && props.gatewayPixKey)} label="Informar conta Pix" />
            <SetupStep done={Boolean(publicBaseUrl && !usingLocalhostWebhook)} label="Informar URL pública" />
            <SetupStep done={Boolean(props.accessTokenConfigured && props.gatewayDefaultCustomerId && props.gatewayWebhookToken)} label="Conectar API e webhook" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <GatewayFields
              props={props}
              providerGuide={providerGuide}
              pixKeyType={pixKeyType}
              publicBaseUrl={publicBaseUrl}
              onPixKeyTypeChange={setPixKeyType}
              onPublicBaseUrlChange={setPublicBaseUrl}
            />
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700">URL de webhook para cadastrar no provedor</p>
            <p className="mt-1 break-all font-mono text-gray-600">{webhookUrl}</p>
            {usingLocalhostWebhook && (
              <p className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-yellow-800">
                Esta URL está em localhost e serve apenas para testes locais. Para cadastrar no provedor, informe a URL pública de produção do SISGO.
              </p>
            )}
            <p className="mt-2">O provedor deve enviar o token secreto no header <span className="font-mono">x-sisgo-webhook-token</span> e o código do pedido em <span className="font-mono">purchase_group_id</span>.</p>
          </div>
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            <p className="font-semibold">Como a automação funciona depois de salva</p>
            <p className="mt-1">1. A pessoa escolhe as refeições e confirma a compra.</p>
            <p>2. O SISGO envia o valor total ao provedor e gera um Pix copia-e-cola para aquele pedido.</p>
            <p>3. O provedor chama o webhook quando o Pix for pago.</p>
            <p>4. O SISGO marca como pago, libera a cozinha e cria a entrada no financeiro.</p>
          </div>
        </div>
      )}

      <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
        Salvar configuração de pagamento
      </button>
    </form>
  )
}

function ProviderGuide({ guide, providerHasAutomaticPix, provider }: {
  guide: ProviderGuide | undefined
  providerHasAutomaticPix: boolean
  provider: string
}) {
  if (!provider) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
        Selecione um provedor para ver os links oficiais de configuração.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-800">
      {!providerHasAutomaticPix && (
        <p className="mb-2 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-yellow-800">
          Este provedor precisa de configuração adicional antes da automação.
        </p>
      )}
      {guide ? (
        <>
          <p className="font-semibold">{guide.name}: {guide.status}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {guide.links.map(link => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer"
                className="rounded-full bg-white px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100">
                {link.label}
              </a>
            ))}
          </div>
          <p className="mt-2">{guide.customerHint}</p>
        </>
      ) : (
        <p className="text-gray-500">Ainda não há links automáticos para este provedor.</p>
      )}
    </div>
  )
}

function GatewayFields({ props, providerGuide, pixKeyType, publicBaseUrl, onPixKeyTypeChange, onPublicBaseUrlChange }: {
  props: Props
  providerGuide: ProviderGuide | undefined
  pixKeyType: string
  publicBaseUrl: string
  onPixKeyTypeChange: (value: string) => void
  onPublicBaseUrlChange: (value: string) => void
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">CNPJ da base</span>
        <input name="gateway_cnpj" defaultValue={props.gatewayCnpj} placeholder="00.000.000/0000-00"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Razão social</span>
        <input name="gateway_legal_name" defaultValue={props.gatewayLegalName} placeholder="Nome jurídico da base"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Tipo da chave Pix</span>
        <select name="gateway_pix_key_type" value={pixKeyType} onChange={(event) => onPixKeyTypeChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
          <option value="cnpj">CNPJ</option>
          <option value="cpf">CPF</option>
          <option value="email">E-mail</option>
          <option value="phone">Telefone</option>
          <option value="random">Chave aleatória</option>
        </select>
        {pixKeyType === 'cpf' && (
          <span className="mt-2 block rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            Para instituições como uma base missionária, o recomendado é utilizar CNPJ ou uma chave Pix institucional.
            Use CPF apenas se a base decidir assumir essa forma de recebimento.
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Chave Pix</span>
        <input name="gateway_pix_key" defaultValue={props.gatewayPixKey} placeholder="Chave Pix que receberá os pagamentos"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Ambiente</span>
        <select name="gateway_environment" defaultValue={props.gatewayEnvironment}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
          <option value="sandbox">Teste / homologação</option>
          <option value="production">Produção</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">ID da conta no provedor</span>
        <input name="gateway_provider_account_id" defaultValue={props.gatewayProviderAccountId} placeholder="Opcional, conforme o provedor"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">ID do cliente pagador padrão</span>
        <input name="gateway_default_customer_id" defaultValue={props.gatewayDefaultCustomerId} placeholder="Ex.: cus_000000000000"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <span className="mt-1 block text-xs text-gray-400">
          {providerGuide?.customerHint ?? 'Use um identificador padrão do pagador exigido pelo provedor.'}
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">URL pública do SISGO</span>
        <input name="gateway_public_base_url" value={publicBaseUrl}
          onChange={(event) => onPublicBaseUrlChange(event.target.value)}
          placeholder="https://app.sisgo.com.br"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <span className="mt-1 block text-xs text-gray-400">
          Use o domínio público de produção. Não use localhost para cadastrar webhook no provedor.
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Token/API key do provedor</span>
        <input name="gateway_access_token" type="password"
          placeholder={props.accessTokenConfigured ? 'Token já configurado. Preencha apenas para trocar.' : 'Cole o token/API key'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Token secreto do webhook SISGO</span>
        <input name="gateway_webhook_token" defaultValue={props.gatewayWebhookToken} placeholder="Gerado automaticamente se ficar vazio"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </label>
    </>
  )
}

function HiddenGatewayFields(props: {
  paymentProvider: string
  gatewayCnpj: string
  gatewayLegalName: string
  gatewayPixKeyType: string
  gatewayPixKey: string
  gatewayEnvironment: string
  gatewayProviderAccountId: string
  gatewayDefaultCustomerId: string
  gatewayPublicBaseUrl: string
  gatewayWebhookToken: string
}) {
  return (
    <>
      <input type="hidden" name="payment_provider" value={props.paymentProvider} />
      <input type="hidden" name="gateway_cnpj" value={props.gatewayCnpj} />
      <input type="hidden" name="gateway_legal_name" value={props.gatewayLegalName} />
      <input type="hidden" name="gateway_pix_key_type" value={props.gatewayPixKeyType} />
      <input type="hidden" name="gateway_pix_key" value={props.gatewayPixKey} />
      <input type="hidden" name="gateway_environment" value={props.gatewayEnvironment} />
      <input type="hidden" name="gateway_provider_account_id" value={props.gatewayProviderAccountId} />
      <input type="hidden" name="gateway_default_customer_id" value={props.gatewayDefaultCustomerId} />
      <input type="hidden" name="gateway_public_base_url" value={props.gatewayPublicBaseUrl} />
      <input type="hidden" name="gateway_webhook_token" value={props.gatewayWebhookToken} />
    </>
  )
}

function SetupStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={done
      ? 'rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs font-medium text-green-700'
      : 'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500'}>
      {done ? 'Pronto: ' : 'Pendente: '}{label}
    </div>
  )
}
