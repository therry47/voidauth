import { inject, Injectable } from '@angular/core'
import { MatPaginatorIntl } from '@angular/material/paginator'
import { TranslateService } from '@ngx-translate/core'
import { Subject } from 'rxjs'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'

/**
 * Custom MatPaginatorIntl that pulls labels from the ngx-translate service,
 * so the paginator (Items per page, X of Y, etc.) follows the selected language.
 */
@Injectable()
export class CustomPaginatorIntl extends MatPaginatorIntl {
  private translate = inject(TranslateService)

  override changes = new Subject<void>()

  constructor() {
    super()

    // React to language changes
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateLabels()
      })

    // Initial labels (will be overwritten when the lang file loads)
    this.updateLabels()
  }

  private updateLabels() {
    this.itemsPerPageLabel = String(this.translate.instant('admin.common.paginator.items-per-page'))
    this.nextPageLabel = String(this.translate.instant('admin.common.paginator.next-page'))
    this.previousPageLabel = String(this.translate.instant('admin.common.paginator.previous-page'))
    this.firstPageLabel = String(this.translate.instant('admin.common.paginator.first-page'))
    this.lastPageLabel = String(this.translate.instant('admin.common.paginator.last-page'))
    this.changes.next()
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    const ofLabel = String(this.translate.instant('admin.common.paginator.of'))
    if (length === 0 || pageSize === 0) {
      return `0 ${ofLabel} ${String(length)}`
    }
    const safeLength = Math.max(length, 0)
    const startIndex = page * pageSize
    const endIndex = startIndex < safeLength
      ? Math.min(startIndex + pageSize, safeLength)
      : startIndex + pageSize
    return `${String(startIndex + 1)} – ${String(endIndex)} ${ofLabel} ${String(safeLength)}`
  }
}
