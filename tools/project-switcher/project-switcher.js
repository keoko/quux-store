// eslint-disable-next-line import/no-unresolved
import 'https://da.live/nx/public/sl/components.js';
// eslint-disable-next-line import/no-unresolved
import getStyle from 'https://da.live/nx/utils/styles.js';
// eslint-disable-next-line import/no-unresolved
import { LitElement, html, nothing } from 'da-lit';
const { token } = await DA_SDK;

const style = await getStyle(import.meta.url);

class ProjectSwitcher extends LitElement {
  static properties = {
    loading: { type: Boolean, state: true },
    projects: { type: Array, state: true },
    projectTree: { type: Object, state: true },
    expandedBrands: { type: Set, state: true },
    expandedEnvs: { type: Set, state: true },
  };

  constructor(props) {
    super(props);
    this.projectTree = {};
    this.expandedBrands = new Set();
    this.expandedEnvs = new Set();
  }

  async connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style];
    const url = 'https://admin.da.live/list/alshaya-axp/';
    const response = await fetch(url,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    const data = await response.json();

    // Loop through each item in the data array
    const parsedData = data.map((item) => {
      if (item.path) {
        const siteName = item.path.split('/')[2];
        const brand = siteName.split('-')[0];
        const env = siteName.split('-')[1];
        const region = siteName.split('-')[2];
        return {
          brand,
          env,
          region,
          fullName: `${brand}-${env}-${region}`,
          displayName: `${brand} (${env}) - ${region}`,
          url: `https://da.live/#/alshaya-axp/${brand}-${env}-${region}-da`,
        };
      }
      return null;
    }).filter((item) => item !== null && item.brand && item.env && item.region);

    this.projects = parsedData;
    this.buildProjectTree();
  }

  buildProjectTree() {
    this.projectTree = {};

    this.projects.forEach((project) => {
      if (!this.projectTree[project.brand]) {
        this.projectTree[project.brand] = {};
      }
      if (!this.projectTree[project.brand][project.env]) {
        this.projectTree[project.brand][project.env] = [];
      }
      this.projectTree[project.brand][project.env].push(project);
    });

    // Auto-expand first brand and environment for better UX
    const brands = Object.keys(this.projectTree);
    if (brands.length > 0) {
      this.expandedBrands.add(brands[0]);
      const firstBrand = brands[0];
      const envs = Object.keys(this.projectTree[firstBrand]);
      if (envs.length > 0) {
        this.expandedEnvs.add(`${firstBrand}-${envs[0]}`);
      }
    }
  }

  toggleBrand(brand) {
    if (this.expandedBrands.has(brand)) {
      this.expandedBrands.delete(brand);
      // Also collapse all environments for this brand
      const envs = Object.keys(this.projectTree[brand] || {});
      envs.forEach((env) => {
        this.expandedEnvs.delete(`${brand}-${env}`);
      });
    } else {
      this.expandedBrands.add(brand);
    }
    this.requestUpdate();
  }

  toggleEnvironment(brand, env) {
    const key = `${brand}-${env}`;
    if (this.expandedEnvs.has(key)) {
      this.expandedEnvs.delete(key);
    } else {
      this.expandedEnvs.add(key);
    }
    this.requestUpdate();
  }

  static handleProjectClick(project) {
    window.open(project.url, '_blank');
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading projects...</div>`;
    }

    if (!this.projects || this.projects.length === 0) {
      return html`<div class="no-projects">No projects available</div>`;
    }

    const brands = Object.keys(this.projectTree);

    return html`
      <div class="project-switcher">
        <header class="switcher-header">
          <h1>Alshaya Project Switcher</h1>
          <p>Browse projects by brand, environment, and region:</p>
        </header>

        <div class="tree-container">
          <div class="project-tree">
            ${brands.map((brand) => {
    const brandData = this.projectTree[brand];
    const envs = Object.keys(brandData);
    const isBrandExpanded = this.expandedBrands.has(brand);

    return html`
                <div class="tree-brand">
                  <div class="brand-header" @click=${() => this.toggleBrand(brand)}>
                    <div class="expand-icon ${isBrandExpanded ? 'expanded' : ''}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                    </div>
                    <h3 class="brand-name">${brand}</h3>
                    <span class="brand-count">${envs.length} environment${envs.length !== 1 ? 's' : ''}</span>
                  </div>

                  ${isBrandExpanded ? html`
                    <div class="brand-content">
                      ${envs.map((env) => {
    const regions = brandData[env];
    const envKey = `${brand}-${env}`;
    const isEnvExpanded = this.expandedEnvs.has(envKey);

    return html`
                          <div class="tree-environment">
                            <div class="env-header" @click=${() => this.toggleEnvironment(brand, env)}>
                              <div class="expand-icon ${isEnvExpanded ? 'expanded' : ''}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <polyline points="6,9 12,15 18,9"></polyline>
                                </svg>
                              </div>
                              <span class="env-name">${env}</span>
                              <span class="env-count">${regions.length} region${regions.length !== 1 ? 's' : ''}</span>
                            </div>

                            ${isEnvExpanded ? html`
                              <div class="env-content">
                                ${regions.map((project) => html`
                                  <div class="project-item" @click=${() => ProjectSwitcher.handleProjectClick(project)}>
                                    <div class="project-info">
                                      <span class="project-region">${project.region}</span>
                                      <span class="project-full-name">${project.fullName}</span>
                                    </div>
                                    <span class="open-project">Open →</span>
                                  </div>
                                `)}
                              </div>
                            ` : nothing}
                          </div>
                        `;
  })}
                    </div>
                  ` : nothing}
                </div>
              `;
  })}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('project-switcher', ProjectSwitcher);
