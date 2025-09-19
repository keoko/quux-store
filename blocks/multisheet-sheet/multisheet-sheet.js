// eslint-disable-next-line import/no-unresolved
import 'https://da.live/nx/public/sl/components.js';
// eslint-disable-next-line import/no-unresolved
import getStyle from 'https://da.live/nx/utils/styles.js';
// eslint-disable-next-line import/no-unresolved
import { LitElement, html, nothing } from 'da-lit';

const style = await getStyle(import.meta.url);

class MultisheetSheet extends LitElement {
  static properties = {
    data: { type: Object, state: true },
    activeSheet: { type: String, state: true },
    loading: { type: Boolean, state: true },
    error: { type: String, state: true },
    editingCell: { type: Object, state: true },
    editedData: { type: Object, state: true },
  };

  constructor() {
    super();
    this.data = null;
    this.activeSheet = null;
    this.loading = true;
    this.error = null;
    this.editingCell = null;
    this.editedData = {};
  }

  async connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style];
    await this.loadData();
  }

  async loadData() {
    try {
      this.loading = true;
      this.error = null;

      // Get the data from the current URL or from a data attribute
      const dataSource = this.getAttribute('data-source') || window.location.href;

      // If it's a URL, fetch the data
      if (dataSource.startsWith('http')) {
        const response = await fetch(dataSource);
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        this.data = await response.json();
      } else {
        // Assume it's already data
        this.data = JSON.parse(dataSource);
      }

      // Set the first sheet as active
      if (this.data && this.data[':names'] && this.data[':names'].length > 0) {
        this.activeSheet = this.data[':names'][0];
      }

      this.loading = false;
    } catch (err) {
      console.error('Error loading multisheet data:', err);
      this.error = err.message;
      this.loading = false;
    }
  }

  switchSheet(sheetName) {
    this.activeSheet = sheetName;
    this.editingCell = null; // Clear editing state when switching sheets
  }

  startEditingCell(rowIndex, header, value) {
    this.editingCell = { rowIndex, header, value };
  }

  stopEditingCell() {
    this.editingCell = null;
  }

  updateCellValue(event) {
    const { rowIndex, header } = this.editingCell;
    const newValue = event.target.textContent;

    // Update the edited data
    if (!this.editedData[this.activeSheet]) {
      this.editedData[this.activeSheet] = {};
    }
    if (!this.editedData[this.activeSheet][rowIndex]) {
      this.editedData[this.activeSheet][rowIndex] = {};
    }
    this.editedData[this.activeSheet][rowIndex][header] = newValue;

    this.stopEditingCell();
  }

  getCellValue(rowIndex, header) {
    // Check if this cell has been edited
    if (this.editedData[this.activeSheet] &&
        this.editedData[this.activeSheet][rowIndex] &&
        this.editedData[this.activeSheet][rowIndex][header] !== undefined) {
      return this.editedData[this.activeSheet][rowIndex][header];
    }

    // Return original data
    const sheetData = this.data[this.activeSheet];
    if (sheetData && sheetData.data && sheetData.data[rowIndex]) {
      return sheetData.data[rowIndex][header] || '';
    }
    return '';
  }

  isCellEditing(rowIndex, header) {
    return this.editingCell &&
           this.editingCell.rowIndex === rowIndex &&
           this.editingCell.header === header;
  }

  saveChanges() {
    // This would typically send the edited data back to the server
    console.log('Saving changes:', this.editedData);
    // TODO: Implement actual save functionality
    this.editedData = {}; // Clear edited data after saving
  }

  renderSheet(sheetName) {
    const sheetData = this.data[sheetName];
    if (!sheetData || !sheetData.data) {
      return html`<p>No data available for sheet: ${sheetName}</p>`;
    }

    const rows = sheetData.data;
    if (rows.length === 0) {
      return html`<p>No data in this sheet</p>`;
    }

    // Get headers from the first row
    const headers = Object.keys(rows[0]);

    return html`
      <div class="sheet-content">
        <div class="sheet-header">
          <h3>${sheetName}</h3>
          <div class="sheet-actions">
            <span class="row-count">${rows.length} rows</span>
            <button
              class="save-button"
              @click=${this.saveChanges}
              ?disabled=${Object.keys(this.editedData).length === 0}
            >
              Save Changes
            </button>
          </div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${headers.map(header => html`<th>${header}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => html`
                <tr>
                  ${headers.map(header => html`
                    <td
                      class="editable-cell ${this.isCellEditing(index, header) ? 'editing' : ''}"
                      @click=${() => this.startEditingCell(index, header, this.getCellValue(index, header))}
                      @blur=${this.updateCellValue}
                      @keydown=${(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          this.updateCellValue(e);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          this.stopEditingCell();
                        }
                      }}
                      contenteditable=${this.isCellEditing(index, header)}
                    >
                      ${this.getCellValue(index, header)}
                    </td>
                  `)}
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <h2>Multisheet Data</h2>
          <p>Loading data...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error">
          <h2>Multisheet Data</h2>
          <p>Error: ${this.error}</p>
        </div>
      `;
    }

    if (!this.data || !this.data[':names']) {
      return html`
        <div class="error">
          <h2>Multisheet Data</h2>
          <p>No multisheet data available</p>
        </div>
      `;
    }

    const sheetNames = this.data[':names'];

    return html`
      <div class="multisheet-container">
        <h2>Multisheet Data</h2>

        <div class="sheet-tabs">
          ${sheetNames.map(sheetName => html`
            <button
              class="sheet-tab ${this.activeSheet === sheetName ? 'active' : ''}"
              @click=${() => this.switchSheet(sheetName)}
            >
              ${sheetName}
            </button>
          `)}
        </div>

        <div class="sheet-content-container">
          ${this.activeSheet ? this.renderSheet(this.activeSheet) : nothing}
        </div>
      </div>
    `;
  }
}

customElements.define('multisheet-sheet', MultisheetSheet);
