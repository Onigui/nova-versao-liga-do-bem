/**
 * Criptografa o cartão NO APARELHO com o SDK oficial do PagBank (PagSeguro.encryptCard),
 * rodando numa WebView invisível. Número e CVV nunca saem do celular em claro: a API da
 * Liga recebe só o texto criptografado, que apenas o PagBank consegue abrir.
 *
 * Uso:
 *   const ref = useRef(null);
 *   <PagBankCardEncryptor ref={ref} />
 *   const encrypted = await ref.current.encrypt({publicKey, holder, number, expMonth, expYear, securityCode});
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import {StyleSheet, View} from 'react-native';
import {WebView} from 'react-native-webview';

const SDK_URL =
  'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';
const TIMEOUT_MS = 20000;

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
  function post(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  window.__encrypt = function (req) {
    try {
      if (!window.PagSeguro || !window.PagSeguro.encryptCard) { post({id: req.id, error: 'sdk_unavailable'}); return; }
      var r = window.PagSeguro.encryptCard({
        publicKey: req.publicKey, holder: req.holder, number: req.number,
        expMonth: req.expMonth, expYear: req.expYear, securityCode: req.securityCode
      });
      if (r.hasErrors) {
        post({id: req.id, error: 'invalid_card', codes: (r.errors || []).map(function (e) { return e.code; })});
        return;
      }
      post({id: req.id, encryptedCard: r.encryptedCard});
    } catch (e) { post({id: req.id, error: String((e && e.message) || e)}); }
  };
</script>
<script src="${SDK_URL}"
  onload="post({type:'ready', sdk: !!window.PagSeguro})"
  onerror="post({type:'ready', sdk: false})"></script>
</body></html>`;

const ERROR_MESSAGES = {
  INVALID_NUMBER: 'Número do cartão inválido.',
  INVALID_SECURITY_CODE: 'Código de segurança (CVV) inválido.',
  INVALID_EXPIRATION_MONTH: 'Mês de validade inválido.',
  INVALID_EXPIRATION_YEAR: 'Ano de validade inválido.',
  INVALID_HOLDER: 'Nome do titular inválido.',
  INVALID_PUBLIC_KEY:
    'Falha na chave de segurança do pagamento. Tente novamente.',
};

export function describeEncryptError(err) {
  const codes = err?.codes || [];
  const known = codes.map(c => ERROR_MESSAGES[c]).filter(Boolean);
  if (known.length) {
    return known.join('\n');
  }
  if (err?.message === 'sdk_unavailable' || err?.message === 'timeout') {
    return 'Não foi possível carregar a proteção do cartão. Verifique sua internet e tente novamente.';
  }
  return 'Não foi possível proteger os dados do cartão. Confira os dados e tente novamente.';
}

const PagBankCardEncryptor = forwardRef(function PagBankCardEncryptor(
  _props,
  ref,
) {
  const webRef = useRef(null);
  const ready = useRef(null); // Promise resolvida quando o SDK carrega
  const resolveReady = useRef(null);
  const pending = useRef(new Map());
  const seq = useRef(0);

  if (!ready.current) {
    ready.current = new Promise(resolve => {
      resolveReady.current = resolve;
    });
  }

  const onMessage = useCallback(event => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      resolveReady.current?.(Boolean(msg.sdk));
      return;
    }
    const entry = pending.current.get(msg.id);
    if (!entry) {
      return;
    }
    pending.current.delete(msg.id);
    clearTimeout(entry.timer);
    if (msg.encryptedCard) {
      entry.resolve(msg.encryptedCard);
    } else {
      const err = new Error(msg.error || 'encrypt_failed');
      err.codes = msg.codes || [];
      entry.reject(err);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    async encrypt(card) {
      const sdkOk = await Promise.race([
        ready.current,
        new Promise(resolve => setTimeout(() => resolve(false), TIMEOUT_MS)),
      ]);
      if (!sdkOk) {
        throw new Error('sdk_unavailable');
      }

      const id = ++seq.current;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current.delete(id);
          reject(new Error('timeout'));
        }, TIMEOUT_MS);
        pending.current.set(id, {resolve, reject, timer});
        const req = JSON.stringify({id, ...card});
        webRef.current?.injectJavaScript(`window.__encrypt(${req}); true;`);
      });
    },
  }));

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webRef}
        source={{html: HTML, baseUrl: 'https://localhost/'}}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
        cacheEnabled={false}
        incognito
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});

export default PagBankCardEncryptor;
