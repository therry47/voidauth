import { Component, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { type Sort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import type { ProxyAuthResponse } from '@shared/api-response/admin/ProxyAuthResponse'
import { AdminService } from '../../../services/admin.service'
import { SnackbarService } from '../../../services/snackbar.service'
import { SpinnerService } from '../../../services/spinner.service'
import type { TableColumn } from '../clients/clients.component'
import { RouterLink } from '@angular/router'
import { MaterialModule } from '../../../material-module'
import { sortWildcardDomains } from '@shared/url'
import { MatDialog } from '@angular/material/dialog'
import { ConfirmComponent } from '../../../dialogs/confirm/confirm.component'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'

@Component({
  selector: 'app-domains',
  imports: [MaterialModule, RouterLink, TranslatePipe],
  templateUrl: './domains.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './domains.component.scss',
})
export class DomainsComponent {
  dataSource: MatTableDataSource<ProxyAuthResponse> = new MatTableDataSource()

  readonly paginator = viewChild.required(MatPaginator)

  columns: TableColumn<ProxyAuthResponse>[] = [
    {
      columnDef: 'domain',
      header: 'admin.common.columns.domain',
      cell: element => element.domain,
    },
    {
      columnDef: 'groups',
      header: 'admin.common.columns.allowed-groups',
      cell: element => element.groups.length ? element.groups.join('\n') : '*',
    },
  ]

  displayedColumns = (this.columns.map(c => c.columnDef) as string[]).concat('actions')

  private adminService = inject(AdminService)
  private snackbarService = inject(SnackbarService)
  private spinnerService = inject(SpinnerService)
  private dialog = inject(MatDialog)
  private translateService = inject(TranslateService)

  async ngAfterViewInit() {
    try {
      // Assign the data to the data source for the table to render
      this.spinnerService.show()
      this.dataSource.data = await this.adminService.proxyAuths()
      this.dataSource.paginator = this.paginator()
    } finally {
      this.spinnerService.hide()
    }
  }

  onSortChange(event: Sort) {
    const field = event.active as keyof ProxyAuthResponse
    if (field === 'domain') {
      this.dataSource.data.sort((a, b) => sortWildcardDomains(a.domain, b.domain))
    } else {
      this.dataSource.data.sort((a, b) => {
        return String(a[field]).localeCompare(String(b[field]), undefined, {
          numeric: false,
          sensitivity: 'base',
        })
      })
    }

    if (event.direction === 'desc') {
      this.dataSource.data.reverse()
    }

    this.dataSource.data = this.dataSource.data.splice(0)
  }

  onDelete(proxyauth_id: string) {
    const domain = this.dataSource.data.find(d => d.id === proxyauth_id)
    const dialogRef = this.dialog.open(ConfirmComponent, {
      data: {
        message: String(this.translateService.instant('admin.domains.messages.confirm-delete', { name: domain?.domain ?? proxyauth_id })),
        header: String(this.translateService.instant('admin.common.dialogs.delete')),
      },
    })

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return
      }

      try {
        this.spinnerService.show()
        await this.adminService.deleteProxyAuth(proxyauth_id)
        this.dataSource.data = this.dataSource.data.filter(c => c.id !== proxyauth_id)
        this.snackbarService.message(String(this.translateService.instant('admin.domains.messages.deleted')))
      } catch (_e) {
        this.snackbarService.error(String(this.translateService.instant('admin.domains.messages.could-not-delete')))
      } finally {
        this.spinnerService.hide()
      }
    })
  }
}
