// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'MercurX Whitepaper',
  tagline: 'MercurX whitepaper',
  favicon: 'img/branding/mercurx-logo-mini.png',

  url: 'https://whitepaper.mercurx.com',
  baseUrl: '/',

  organizationName: 'umutayd',
  projectName: 'whitepaper-mercurx',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        logo: {
          alt: 'MercurX',
          src: 'img/branding/mercurx-logo.png',
          srcDark: 'img/branding/mercurx-logo-white.png',
          href: '/',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'whitepaperSidebar',
            label: 'Whitepaper',
            position: 'left',
          },
        ],
      },
    }),
};

module.exports = config;
