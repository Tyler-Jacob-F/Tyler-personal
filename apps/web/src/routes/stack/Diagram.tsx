import { cn } from '@/lib/utils';

export interface DiagramProps {
  selected: string | null;
  litNodes: Set<string>;
  litEdges: Set<string>;
  tracing: boolean;
  onSelect(id: string): void;
}

/**
 * The system drawn by hand: five stacks as lanes, the browser and GitHub above, the CDK
 * bootstrap below. Solid arrows carry data, dashed ones carry trust or configuration.
 * Styled through the theme tokens only, so it reads in both themes.
 */
export function Diagram({ selected, litNodes, litEdges, tracing, onSelect }: DiagramProps) {
  const nc = (id: string, ext = false) =>
    cn(
      'cursor-pointer outline-none focus-visible:[&>rect]:stroke-text focus-visible:[&>rect]:[stroke-width:2.4]',
      '[&>rect]:fill-bg [&>rect]:stroke-text [&>rect]:[stroke-width:1.2]',
      ext && '[&>rect]:[stroke-dasharray:4_3]',
      selected === id && '[&>rect]:fill-muted [&>rect]:[stroke-width:2]',
      litNodes.has(id) &&
        '[&>rect]:fill-surface-raised [&>rect]:stroke-accent [&>rect]:[stroke-width:2.2]',
      tracing && !litNodes.has(id) && selected !== id && 'opacity-40',
    );
  const ec = (id: string, dashed = false) =>
    cn(
      'fill-none stroke-text [stroke-width:1.1] opacity-55',
      dashed && '[stroke-dasharray:5_4]',
      litEdges.has(id) && 'stroke-accent [stroke-width:2.4] opacity-100',
      tracing && !litEdges.has(id) && 'opacity-15',
    );
  const me = (id: string) => (litEdges.has(id) ? 'url(#arrow-warm)' : 'url(#arrow)');

  return (
    <svg
      viewBox="0 0 980 830"
      role="img"
      className="block h-auto max-w-full text-text"
      aria-label="The Keep's five stacks and how a browser, agents with tokens, GitHub Actions and the API Lambdas reach CloudFront, Cognito, API Gateway, the MCP server and Aurora"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-text"></path>
        </marker>
        <marker
          id="arrow-warm"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-accent"></path>
        </marker>
      </defs>

      <rect
        className="fill-none stroke-border [stroke-dasharray:3_4]"
        x="12"
        y="118"
        width="560"
        height="118"
        rx="10"
      ></rect>
      <text
        className="fill-muted text-[11px] font-semibold tracking-wider uppercase"
        x="24"
        y="136"
      >
        TheKeepSite
      </text>
      <rect
        className="fill-none stroke-border [stroke-dasharray:3_4]"
        x="588"
        y="118"
        width="380"
        height="118"
        rx="10"
      ></rect>
      <text
        className="fill-muted text-[11px] font-semibold tracking-wider uppercase"
        x="600"
        y="136"
      >
        TheKeepAccount · deployed once by hand
      </text>
      <rect
        className="fill-none stroke-border [stroke-dasharray:3_4]"
        x="12"
        y="262"
        width="470"
        height="150"
        rx="10"
      ></rect>
      <text
        className="fill-muted text-[11px] font-semibold tracking-wider uppercase"
        x="24"
        y="280"
      >
        TheKeepAuth
      </text>
      <rect
        className="fill-none stroke-border [stroke-dasharray:3_4]"
        x="498"
        y="262"
        width="470"
        height="220"
        rx="10"
      ></rect>
      <text
        className="fill-muted text-[11px] font-semibold tracking-wider uppercase"
        x="510"
        y="280"
      >
        TheKeepApi
      </text>
      <rect
        className="fill-none stroke-border [stroke-dasharray:3_4]"
        x="12"
        y="508"
        width="956"
        height="150"
        rx="10"
      ></rect>
      <text
        className="fill-muted text-[11px] font-semibold tracking-wider uppercase"
        x="24"
        y="526"
      >
        TheKeepData
      </text>
      <rect
        className="fill-none stroke-border [stroke-dasharray:3_4]"
        x="12"
        y="684"
        width="956"
        height="128"
        rx="10"
      ></rect>
      <text
        className="fill-muted text-[11px] font-semibold tracking-wider uppercase"
        x="24"
        y="702"
      >
        CDK bootstrap · created by `cdk bootstrap`, used by every deploy
      </text>

      <path
        className={ec('e-browser-cf')}
        id="e-browser-cf"
        d="M160,74 L160,158"
        markerEnd={me('e-browser-cf')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="166" y="104">
        https, TLS at the edge
      </text>
      <path
        className={ec('e-r53-cf')}
        id="e-r53-cf"
        d="M110,186 L128,186"
        markerEnd={me('e-r53-cf')}
      ></path>
      <path
        className={ec('e-cf-s3')}
        id="e-cf-s3"
        d="M300,186 L336,186"
        markerEnd={me('e-cf-s3')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="302" y="178">
        static files
      </text>
      <path
        className={ec('e-cf-fn')}
        id="e-cf-fn"
        d="M214,206 L214,222"
        markerEnd={me('e-cf-fn')}
      ></path>
      <path
        className={ec('e-cf-apigw')}
        id="e-cf-apigw"
        d="M214,206 L214,246 L560,246 L560,292"
        markerEnd={me('e-cf-apigw')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="380" y="241">
        /api/*, uncached, Authorization forwarded
      </text>
      <path
        className={ec('e-browser-cognito')}
        id="e-browser-cognito"
        d="M96,74 L96,100 L48,100 L48,310 L60,310"
        markerEnd={me('e-browser-cognito')}
      ></path>
      <text
        className="fill-muted text-[10.5px]"
        x="20"
        y="256"
        transform="rotate(-90 20 256)"
        textAnchor="middle"
      >
        sign in
      </text>
      <path
        className={ec('e-cognito-triggers')}
        id="e-cognito-triggers"
        d="M172,316 L206,316"
        markerEnd={me('e-cognito-triggers')}
      ></path>
      <path
        className={ec('e-create-ses')}
        id="e-create-ses"
        d="M330,342 L330,368"
        markerEnd={me('e-create-ses')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="336" y="360">
        sends the code
      </text>
      <path
        className={ec('e-authorizer-jwks', true)}
        id="e-authorizer-jwks"
        d="M640,340 L640,360 L172,360 L172,340"
        markerEnd={me('e-authorizer-jwks')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="420" y="356">
        verifies with the pool's public keys
      </text>
      <path
        className={ec('e-apigw-authz')}
        id="e-apigw-authz"
        d="M560,336 L560,350 L600,350 L600,336"
        markerEnd={me('e-apigw-authz')}
      ></path>
      <path
        className={ec('e-authz-lambdas')}
        id="e-authz-lambdas"
        d="M700,320 L724,320"
        markerEnd={me('e-authz-lambdas')}
      ></path>
      <path
        className={ec('e-lambdas-dataapi')}
        id="e-lambdas-dataapi"
        d="M800,370 L800,400 L372,400 L372,548"
        markerEnd={me('e-lambdas-dataapi')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="420" y="396">
        ExecuteStatement over https, signed with the function's role
      </text>
      <path
        className={ec('e-lambdas-logs')}
        id="e-lambdas-logs"
        d="M884,320 L902,320"
        markerEnd={me('e-lambdas-logs')}
      ></path>
      <path
        className={ec('e-dataapi-aurora')}
        id="e-dataapi-aurora"
        d="M300,584 L250,584"
        markerEnd={me('e-dataapi-aurora')}
      ></path>
      <path
        className={ec('e-aurora-secret', true)}
        id="e-aurora-secret"
        d="M250,610 L250,630 L520,630 L520,610"
        markerEnd={me('e-aurora-secret')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="300" y="626">
        master password lives here, never in a Lambda
      </text>
      <path
        className={ec('e-gh-oidc')}
        id="e-gh-oidc"
        d="M740,74 L740,158"
        markerEnd={me('e-gh-oidc')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="746" y="104">
        signed JWT: repo, branch
      </text>
      <path
        className={ec('e-oidc-deploy')}
        id="e-oidc-deploy"
        d="M790,186 L826,186"
        markerEnd={me('e-oidc-deploy')}
      ></path>
      <path
        className={ec('e-deploy-cfn')}
        id="e-deploy-cfn"
        d="M900,206 L900,250 L950,250 L950,730 L880,730"
        markerEnd={me('e-deploy-cfn')}
      ></path>
      <text
        className="fill-muted text-[10.5px]"
        x="956"
        y="520"
        transform="rotate(90 956 450)"
        textAnchor="middle"
      >
        cdk deploy: assets, then the template
      </text>
      <path
        className={ec('e-cfn-stacks')}
        id="e-cfn-stacks"
        d="M760,730 L700,730 L700,486"
        markerEnd={me('e-cfn-stacks')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="706" y="710">
        creates and updates every stack
      </text>
      <path
        className={ec('e-gh-dataapi')}
        id="e-gh-dataapi"
        d="M680,74 L680,96 L560,96 L560,110 L440,110 L440,120"
        markerEnd={me('e-gh-dataapi')}
      ></path>
      <path
        className={ec('e-gh-migrate', true)}
        id="e-gh-migrate"
        d="M380,96 L380,110"
        markerEnd={me('e-gh-migrate')}
      ></path>
      <path
        className={ec('e-gh-s3')}
        id="e-gh-s3"
        d="M640,74 L640,92 L410,92 L410,152"
        markerEnd={me('e-gh-s3')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="416" y="138">
        sync build, invalidate
      </text>

      <path
        className={ec('e-agents-cf')}
        id="e-agents-cf"
        d="M330,74 L330,120 L280,120 L280,158"
        markerEnd={me('e-agents-cf')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="336" y="112">
        Bearer token
      </text>
      <path
        className={ec('e-apigw-agentauth')}
        id="e-apigw-agentauth"
        d="M528,336 L528,420"
        markerEnd={me('e-apigw-agentauth')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="534" y="378">
        /api/agent/*, /mcp
      </text>
      <path
        className={ec('e-agentauth-mcp')}
        id="e-agentauth-mcp"
        d="M688,442 L724,442"
        markerEnd={me('e-agentauth-mcp')}
      ></path>
      <path
        className={ec('e-agentauth-lambdas')}
        id="e-agentauth-lambdas"
        d="M676,420 L676,408 L812,408 L812,370"
        markerEnd={me('e-agentauth-lambdas')}
      ></path>
      <path
        className={ec('e-mcp-lambdas', true)}
        id="e-mcp-lambdas"
        d="M840,420 L840,370"
        markerEnd={me('e-mcp-lambdas')}
      ></path>
      <text className="fill-muted text-[10.5px]" x="848" y="412">
        same code
      </text>
      <path
        className={ec('e-mcp-dataapi')}
        id="e-mcp-dataapi"
        d="M760,464 L760,492 L420,492 L420,548"
        markerEnd={me('e-mcp-dataapi')}
      ></path>

      <g
        className={nc('browser', true)}
        data-id="browser"
        tabIndex={0}
        role="button"
        aria-label="Browser"
        aria-pressed={selected === 'browser'}
        onClick={() => onSelect('browser')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('browser');
          }
        }}
      >
        <rect x="80" y="30" width="160" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="160" y="50" textAnchor="middle">
          Your browser
        </text>
        <text className="fill-muted text-[10.5px]" x="160" y="65" textAnchor="middle">
          React SPA, in-memory tokens
        </text>
      </g>
      <g
        className={nc('github', true)}
        data-id="github"
        tabIndex={0}
        role="button"
        aria-label="GitHub Actions"
        aria-pressed={selected === 'github'}
        onClick={() => onSelect('github')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('github');
          }
        }}
      >
        <rect x="620" y="30" width="240" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="740" y="50" textAnchor="middle">
          GitHub Actions
        </text>
        <text className="fill-muted text-[10.5px]" x="740" y="65" textAnchor="middle">
          PR: test, lint, typecheck, cdk diff · main: deploy
        </text>
      </g>

      <g
        className={nc('agents', true)}
        data-id="agents"
        tabIndex={0}
        role="button"
        aria-label="Agent clients"
        aria-pressed={selected === 'agents'}
        onClick={() => onSelect('agents')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('agents');
          }
        }}
      >
        <rect x="290" y="30" width="250" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="415" y="49" textAnchor="middle">
          Claude Code · Cowork
        </text>
        <text className="fill-muted text-[10.5px]" x="415" y="64" textAnchor="middle">
          agents, each with a scoped token
        </text>
      </g>
      <g
        className={nc('agentauth')}
        data-id="agentauth"
        tabIndex={0}
        role="button"
        aria-label="Agent token authorizer"
        aria-pressed={selected === 'agentauth'}
        onClick={() => onSelect('agentauth')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('agentauth');
          }
        }}
      >
        <rect x="512" y="420" width="176" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="600" y="439" textAnchor="middle">
          Agent token authorizer
        </text>
        <text className="fill-muted text-[10.5px]" x="600" y="454" textAnchor="middle">
          Lambda · hashes the bearer, loads scopes
        </text>
      </g>
      <g
        className={nc('mcp')}
        data-id="mcp"
        tabIndex={0}
        role="button"
        aria-label="MCP server"
        aria-pressed={selected === 'mcp'}
        onClick={() => onSelect('mcp')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('mcp');
          }
        }}
      >
        <rect x="724" y="420" width="160" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="804" y="439" textAnchor="middle">
          MCP server
        </text>
        <text className="fill-muted text-[10.5px]" x="804" y="454" textAnchor="middle">
          Lambda · /mcp, six tools
        </text>
      </g>
      <g
        className={nc('route53')}
        data-id="route53"
        tabIndex={0}
        role="button"
        aria-label="Route 53"
        aria-pressed={selected === 'route53'}
        onClick={() => onSelect('route53')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('route53');
          }
        }}
      >
        <rect x="24" y="158" width="86" height="56" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="67" y="180" textAnchor="middle">
          Route 53
        </text>
        <text className="fill-muted text-[10.5px]" x="67" y="196" textAnchor="middle">
          zone, alias, DKIM
        </text>
      </g>
      <g
        className={nc('cloudfront')}
        data-id="cloudfront"
        tabIndex={0}
        role="button"
        aria-label="CloudFront"
        aria-pressed={selected === 'cloudfront'}
        onClick={() => onSelect('cloudfront')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('cloudfront');
          }
        }}
      >
        <rect x="128" y="158" width="172" height="48" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="214" y="178" textAnchor="middle">
          CloudFront
        </text>
        <text className="fill-muted text-[10.5px]" x="214" y="194" textAnchor="middle">
          one origin for everything
        </text>
      </g>
      <g
        className={nc('cffunction')}
        data-id="cffunction"
        tabIndex={0}
        role="button"
        aria-label="CloudFront Function"
        aria-pressed={selected === 'cffunction'}
        onClick={() => onSelect('cffunction')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('cffunction');
          }
        }}
      >
        <rect x="144" y="222" width="140" height="10" rx="4"></rect>
        <text className="fill-muted" x="214" y="231" textAnchor="middle" fontSize={8.5}>
          SPA rewrite function
        </text>
      </g>
      <g
        className={nc('s3')}
        data-id="s3"
        tabIndex={0}
        role="button"
        aria-label="S3 bucket"
        aria-pressed={selected === 's3'}
        onClick={() => onSelect('s3')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('s3');
          }
        }}
      >
        <rect x="336" y="158" width="150" height="48" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="411" y="178" textAnchor="middle">
          S3 bucket
        </text>
        <text className="fill-muted text-[10.5px]" x="411" y="194" textAnchor="middle">
          private, built SPA
        </text>
      </g>
      <g
        className={nc('acm')}
        data-id="acm"
        tabIndex={0}
        role="button"
        aria-label="ACM certificate"
        aria-pressed={selected === 'acm'}
        onClick={() => onSelect('acm')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('acm');
          }
        }}
      >
        <rect x="500" y="158" width="64" height="48" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="532" y="178" textAnchor="middle">
          ACM
        </text>
        <text className="fill-muted text-[10.5px]" x="532" y="194" textAnchor="middle">
          TLS cert
        </text>
      </g>

      <g
        className={nc('oidc')}
        data-id="oidc"
        tabIndex={0}
        role="button"
        aria-label="GitHub OIDC provider"
        aria-pressed={selected === 'oidc'}
        onClick={() => onSelect('oidc')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('oidc');
          }
        }}
      >
        <rect x="620" y="158" width="170" height="56" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="705" y="180" textAnchor="middle">
          OIDC provider
        </text>
        <text className="fill-muted text-[10.5px]" x="705" y="196" textAnchor="middle">
          AWS trusts GitHub's issuer
        </text>
      </g>
      <g
        className={nc('roles')}
        data-id="roles"
        tabIndex={0}
        role="button"
        aria-label="Deploy and PR roles"
        aria-pressed={selected === 'roles'}
        onClick={() => onSelect('roles')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('roles');
          }
        }}
      >
        <rect x="826" y="158" width="132" height="48" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="892" y="178" textAnchor="middle">
          Deploy / PR roles
        </text>
        <text className="fill-muted text-[10.5px]" x="892" y="194" textAnchor="middle">
          1-hour credentials
        </text>
      </g>
      <g
        className={nc('budget')}
        data-id="budget"
        tabIndex={0}
        role="button"
        aria-label="Budget"
        aria-pressed={selected === 'budget'}
        onClick={() => onSelect('budget')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('budget');
          }
        }}
      >
        <rect x="826" y="212" width="132" height="18" rx="6"></rect>
        <text className="fill-muted" x="892" y="225" textAnchor="middle" fontSize={10}>
          $5 budget, emails you
        </text>
      </g>

      <g
        className={nc('cognito')}
        data-id="cognito"
        tabIndex={0}
        role="button"
        aria-label="Cognito user pool"
        aria-pressed={selected === 'cognito'}
        onClick={() => onSelect('cognito')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('cognito');
          }
        }}
      >
        <rect x="60" y="292" width="112" height="48" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="116" y="312" textAnchor="middle">
          Cognito pool
        </text>
        <text className="fill-muted text-[10.5px]" x="116" y="328" textAnchor="middle">
          one user, no sign-up
        </text>
      </g>
      <g
        className={nc('triggers')}
        data-id="triggers"
        tabIndex={0}
        role="button"
        aria-label="Custom auth trigger Lambdas"
        aria-pressed={selected === 'triggers'}
        onClick={() => onSelect('triggers')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('triggers');
          }
        }}
      >
        <rect x="206" y="292" width="248" height="50" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="330" y="310" textAnchor="middle">
          define · create · verify
        </text>
        <text className="fill-muted text-[10.5px]" x="330" y="326" textAnchor="middle">
          three Lambdas Cognito calls in turn
        </text>
      </g>
      <g
        className={nc('ses')}
        data-id="ses"
        tabIndex={0}
        role="button"
        aria-label="SES"
        aria-pressed={selected === 'ses'}
        onClick={() => onSelect('ses')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('ses');
          }
        }}
      >
        <rect x="270" y="368" width="120" height="34" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="330" y="389" textAnchor="middle">
          SES, sandbox
        </text>
      </g>
      <g
        className={nc('appclient')}
        data-id="appclient"
        tabIndex={0}
        role="button"
        aria-label="App client"
        aria-pressed={selected === 'appclient'}
        onClick={() => onSelect('appclient')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('appclient');
          }
        }}
      >
        <rect x="60" y="368" width="112" height="34" rx="8"></rect>
        <text className="fill-muted" x="116" y="389" textAnchor="middle" fontSize={11}>
          app client: custom + refresh
        </text>
      </g>

      <g
        className={nc('apigw')}
        data-id="apigw"
        tabIndex={0}
        role="button"
        aria-label="API Gateway HTTP API"
        aria-pressed={selected === 'apigw'}
        onClick={() => onSelect('apigw')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('apigw');
          }
        }}
      >
        <rect x="512" y="292" width="96" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="560" y="311" textAnchor="middle">
          HTTP API
        </text>
        <text className="fill-muted text-[10.5px]" x="560" y="326" textAnchor="middle">
          API Gateway
        </text>
      </g>
      <g
        className={nc('authorizer')}
        data-id="authorizer"
        tabIndex={0}
        role="button"
        aria-label="JWT authorizer"
        aria-pressed={selected === 'authorizer'}
        onClick={() => onSelect('authorizer')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('authorizer');
          }
        }}
      >
        <rect x="600" y="292" width="100" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="650" y="311" textAnchor="middle">
          JWT authorizer
        </text>
        <text className="fill-muted text-[10.5px]" x="650" y="326" textAnchor="middle">
          before any Lambda
        </text>
      </g>
      <g
        className={nc('lambdas')}
        data-id="lambdas"
        tabIndex={0}
        role="button"
        aria-label="API Lambdas"
        aria-pressed={selected === 'lambdas'}
        onClick={() => onSelect('lambdas')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('lambdas');
          }
        }}
      >
        <rect x="724" y="292" width="160" height="78" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="804" y="312" textAnchor="middle">
          me · documents · versions
        </text>
        <text className="fill-muted text-[10.5px]" x="804" y="328" textAnchor="middle">
          Node 22, arm64, esbuild bundles
        </text>
        <text className="fill-muted text-[10.5px]" x="804" y="344" textAnchor="middle">
          identity → permission → handler
        </text>
        <text className="fill-muted text-[10.5px]" x="804" y="360" textAnchor="middle">
          not in the VPC
        </text>
      </g>
      <g
        className={nc('cloudwatch')}
        data-id="cloudwatch"
        tabIndex={0}
        role="button"
        aria-label="CloudWatch"
        aria-pressed={selected === 'cloudwatch'}
        onClick={() => onSelect('cloudwatch')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('cloudwatch');
          }
        }}
      >
        <rect x="902" y="292" width="58" height="78" rx="8"></rect>
        <text className="fill-text" x="931" y="320" textAnchor="middle" fontSize={11}>
          Cloud
        </text>
        <text className="fill-text" x="931" y="334" textAnchor="middle" fontSize={11}>
          Watch
        </text>
        <text className="fill-muted text-[10.5px]" x="931" y="352" textAnchor="middle">
          logs 30d
        </text>
        <text className="fill-muted text-[10.5px]" x="931" y="364" textAnchor="middle">
          1 dashboard
        </text>
      </g>

      <rect className="fill-none stroke-border" x="24" y="540" width="246" height="106"></rect>
      <text className="fill-muted text-[10.5px] italic" x="34" y="556">
        VPC: two isolated subnets, no NAT, no internet
      </text>
      <g
        className={nc('aurora')}
        data-id="aurora"
        tabIndex={0}
        role="button"
        aria-label="Aurora Serverless v2 cluster"
        aria-pressed={selected === 'aurora'}
        onClick={() => onSelect('aurora')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('aurora');
          }
        }}
      >
        <rect x="40" y="564" width="210" height="64" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="145" y="584" textAnchor="middle">
          Aurora Serverless v2
        </text>
        <text className="fill-muted text-[10.5px]" x="145" y="600" textAnchor="middle">
          PostgreSQL 16, 0 to 2 ACU
        </text>
        <text className="fill-muted text-[10.5px]" x="145" y="616" textAnchor="middle">
          pauses after 5 idle minutes
        </text>
      </g>
      <g
        className={nc('dataapi')}
        data-id="dataapi"
        tabIndex={0}
        role="button"
        aria-label="RDS Data API"
        aria-pressed={selected === 'dataapi'}
        onClick={() => onSelect('dataapi')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('dataapi');
          }
        }}
      >
        <rect x="300" y="548" width="144" height="60" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="372" y="570" textAnchor="middle">
          RDS Data API
        </text>
        <text className="fill-muted text-[10.5px]" x="372" y="586" textAnchor="middle">
          https endpoint, IAM auth
        </text>
        <text className="fill-muted text-[10.5px]" x="372" y="600" textAnchor="middle">
          the only way in
        </text>
      </g>
      <g
        className={nc('secret')}
        data-id="secret"
        tabIndex={0}
        role="button"
        aria-label="Secrets Manager"
        aria-pressed={selected === 'secret'}
        onClick={() => onSelect('secret')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('secret');
          }
        }}
      >
        <rect x="470" y="564" width="140" height="46" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="540" y="584" textAnchor="middle">
          Secrets Manager
        </text>
        <text className="fill-muted text-[10.5px]" x="540" y="600" textAnchor="middle">
          master credentials
        </text>
      </g>
      <g
        className={nc('ssm')}
        data-id="ssm"
        tabIndex={0}
        role="button"
        aria-label="SSM parameters"
        aria-pressed={selected === 'ssm'}
        onClick={() => onSelect('ssm')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('ssm');
          }
        }}
      >
        <rect x="640" y="564" width="140" height="46" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="710" y="584" textAnchor="middle">
          SSM parameters
        </text>
        <text className="fill-muted text-[10.5px]" x="710" y="600" textAnchor="middle">
          /the-keep/db/*
        </text>
      </g>
      <g
        className={nc('migrations')}
        data-id="migrations"
        tabIndex={0}
        role="button"
        aria-label="Migrations"
        aria-pressed={selected === 'migrations'}
        onClick={() => onSelect('migrations')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('migrations');
          }
        }}
      >
        <rect x="808" y="564" width="140" height="46" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="878" y="584" textAnchor="middle">
          schema_migration
        </text>
        <text className="fill-muted text-[10.5px]" x="878" y="600" textAnchor="middle">
          0001 to 0004 applied
        </text>
      </g>

      <g
        className={nc('cfn')}
        data-id="cfn"
        tabIndex={0}
        role="button"
        aria-label="CloudFormation"
        aria-pressed={selected === 'cfn'}
        onClick={() => onSelect('cfn')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('cfn');
          }
        }}
      >
        <rect x="760" y="710" width="120" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="820" y="729" textAnchor="middle">
          CloudFormation
        </text>
        <text className="fill-muted text-[10.5px]" x="820" y="745" textAnchor="middle">
          diffs, applies, rolls back
        </text>
      </g>
      <g
        className={nc('execrole')}
        data-id="execrole"
        tabIndex={0}
        role="button"
        aria-label="CDK execution role"
        aria-pressed={selected === 'execrole'}
        onClick={() => onSelect('execrole')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('execrole');
          }
        }}
      >
        <rect x="560" y="710" width="180" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="650" y="729" textAnchor="middle">
          cdk-*-cfn-exec-role
        </text>
        <text className="fill-muted text-[10.5px]" x="650" y="745" textAnchor="middle">
          the only admin, used only by CFN
        </text>
      </g>
      <g
        className={nc('assets')}
        data-id="assets"
        tabIndex={0}
        role="button"
        aria-label="CDK assets bucket"
        aria-pressed={selected === 'assets'}
        onClick={() => onSelect('assets')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('assets');
          }
        }}
      >
        <rect x="380" y="710" width="160" height="44" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="460" y="729" textAnchor="middle">
          cdk assets bucket
        </text>
        <text className="fill-muted text-[10.5px]" x="460" y="745" textAnchor="middle">
          Lambda zips, templates
        </text>
      </g>
      <g
        className={nc('cdk')}
        data-id="cdk"
        tabIndex={0}
        role="button"
        aria-label="CDK app"
        aria-pressed={selected === 'cdk'}
        onClick={() => onSelect('cdk')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('cdk');
          }
        }}
      >
        <rect x="40" y="710" width="310" height="80" rx="8"></rect>
        <text className="fill-text text-[12.5px]" x="195" y="730" textAnchor="middle">
          infra/ (CDK, TypeScript)
        </text>
        <text className="fill-muted text-[10.5px]" x="195" y="746" textAnchor="middle">
          synth → CloudFormation JSON in cdk.out
        </text>
        <text className="fill-muted text-[10.5px]" x="195" y="762" textAnchor="middle">
          snapshot tests freeze every template
        </text>
        <text className="fill-muted text-[10.5px]" x="195" y="778" textAnchor="middle">
          cdk diff on every pull request
        </text>
      </g>
    </svg>
  );
}
