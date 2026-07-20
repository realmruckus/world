const siteRoot = new URL("../../", import.meta.url);

const navigationItems = [
  ["play.html", "MVP"],
  ["development-plan.html", "开发计划"],
  ["architecture.html", "架构"],
  ["docs/index.html", "设计文档"],
  ["releases.html", "版本迭代"],
  ["status.html", "项目状态"],
];

function isCurrentPage(relativePath) {
  const currentPath = window.location.pathname.replace(/\/+$/, "");
  const targetPath = new URL(relativePath, siteRoot).pathname.replace(/\/+$/, "");

  if (relativePath === "docs/index.html") {
    const docsPath = new URL("docs/", siteRoot).pathname.replace(/\/+$/, "");
    return currentPath === targetPath || currentPath.startsWith(`${docsPath}/`);
  }

  return currentPath === targetPath;
}

class WorldSiteHeader extends HTMLElement {
  connectedCallback() {
    const links = navigationItems
      .map(([relativePath, label]) => {
        const current = isCurrentPage(relativePath);
        const attributes = current ? ' aria-current="page"' : "";
        return `<a href="${new URL(relativePath, siteRoot).href}"${attributes}>${label}</a>`;
      })
      .join("");

    this.innerHTML = `
      <header class="site-header">
        <a class="brand" href="${new URL("index.html", siteRoot).href}">Realm Ruckus WORLD</a>
        <nav aria-label="主导航">${links}</nav>
      </header>
    `;
  }
}

if (!customElements.get("world-site-header")) {
  customElements.define("world-site-header", WorldSiteHeader);
}
