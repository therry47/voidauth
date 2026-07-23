import { CommonModule } from '@angular/common'
import { Component, inject, ChangeDetectionStrategy } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MaterialModule } from '../../../../material-module'
import { ValidationErrorPipe } from '../../../../pipes/ValidationErrorPipe'
import { AdminService } from '../../../../services/admin.service'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { SnackbarService } from '../../../../services/snackbar.service'
import type { TypedControls } from '../../clients/upsert-client/upsert-client.component'
import type { GroupUpsert } from '@shared/api-request/admin/GroupUpsert'
import type { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import type { UserWithoutPassword } from '@shared/api-response/UserDetails'
import type { GroupUsers } from '@shared/api-response/admin/GroupUsers'
import { ADMIN_GROUP } from '@shared/constants'
import { SpinnerService } from '../../../../services/spinner.service'
import { MatDialog } from '@angular/material/dialog'
import { ConfirmComponent } from '../../../../dialogs/confirm/confirm.component'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'
import type { Nullable } from '@shared/utils'

@Component({
  selector: 'app-group',
  imports: [CommonModule, MaterialModule, ValidationErrorPipe, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './group.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './group.component.scss',
})
export class GroupComponent {
  ADMIN_GROUP = ADMIN_GROUP

  public id: string | null = null

  public users: UserWithoutPassword[] = []
  public unselectedUsers: UserWithoutPassword[] = []
  public selectableUsers: UserWithoutPassword[] = []
  userSelect = new FormControl<UserWithoutPassword | null>(null)

  public form = new FormGroup({
    // only alphanumeric, underscore, and hyphen
    name: new FormControl<string | null>(null, [Validators.required, Validators.pattern('^[A-Za-z0-9_-]+$')]),
    users: new FormControl<GroupUsers['users']>([], { nonNullable: true }),
    mfaRequired: new FormControl<boolean>(false, { nonNullable: true }),
    autoAssign: new FormControl<boolean>(false, { nonNullable: true }),
  }) satisfies FormGroup<TypedControls<Omit<GroupUpsert, 'id' | 'name'> & Nullable<Pick<GroupUpsert, 'name'>>>>

  private adminService = inject(AdminService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private snackbarService = inject(SnackbarService)
  private spinnerService = inject(SpinnerService)
  private dialog = inject(MatDialog)
  private translateService = inject(TranslateService)

  ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      try {
        this.spinnerService.show()
        const id = params.get('id')

        if (id) {
          this.id = id
          const group = await this.adminService.group(this.id)
          this.form.reset({
            name: group.name,
            mfaRequired: !!group.mfaRequired,
            autoAssign: !!group.autoAssign,
            users: group.users.map((u) => {
              return { id: u.id, username: u.username }
            }),
          })
        }

        this.users = await this.adminService.users()
        this.userAutoFilter()

        if (this.form.controls.name.value?.toLowerCase() === ADMIN_GROUP.toLowerCase()) {
          this.form.controls.name.disable()
          this.form.controls.autoAssign.setValue(false)
          this.form.controls.autoAssign.disable()
        }
      } catch (e) {
        console.error(e)
        this.snackbarService.error(String(this.translateService.instant('admin.group.messages.error-loading')))
      } finally {
        this.spinnerService.hide()
      }
    })
  }

  userAutoFilter(value: string = '') {
    this.unselectedUsers = this.users.filter((u) => {
      return !this.form.controls.users.value.find(gu => u.id === gu.id)
    })
    this.selectableUsers = this.unselectedUsers
      .filter((u) => {
        return (
          u.username.toLowerCase().includes(value.toLowerCase())
          || u.email?.toLowerCase().includes(value.toLowerCase())
          || u.name?.toLowerCase().includes(value.toLowerCase())
        )
      })
      .slice(0, 5)
    if (this.unselectedUsers.length) {
      this.userSelect.enable()
    } else {
      this.userSelect.disable()
    }
  }

  addUser(event: MatAutocompleteSelectedEvent) {
    const value = event.option.value as UserWithoutPassword | null
    if (!value) {
      return
    }
    this.form.controls.users.setValue(
      [{ id: value.id, username: value.username }].concat(this.form.controls.users.value).sort((a, b) => {
        return a.id > b.id ? 1 : -1
      }),
    )
    this.form.controls.users.markAsDirty()
    this.userSelect.setValue(null)
    this.userAutoFilter()
  }

  removeUser(value: string) {
    this.form.controls.users.setValue(this.form.controls.users.value.filter(u => u.id !== value))
    this.form.controls.users.markAsDirty()
    this.userAutoFilter()
  }

  async submit() {
    try {
      const values = this.form.getRawValue()
      const { name } = values
      if (name == null) {
        throw new Error('Missing name.')
      }

      this.spinnerService.show()
      const group = await this.adminService.upsertGroup({ ...values, name, id: this.id ?? undefined })
      const msgKey = this.id ? 'admin.group.messages.updated' : 'admin.group.messages.created'
      this.snackbarService.message(String(this.translateService.instant(msgKey)))

      this.id = group.id
      await this.router.navigate(['/admin/group', this.id], {
        replaceUrl: true,
      })
    } catch (_e) {
      const errKey = this.id ? 'admin.group.messages.could-not-update' : 'admin.group.messages.could-not-create'
      this.snackbarService.error(String(this.translateService.instant(errKey)))
    } finally {
      this.spinnerService.hide()
    }
  }

  remove() {
    const dialogRef = this.dialog.open(ConfirmComponent, {
      data: {
        message: String(this.translateService.instant('admin.group.messages.confirm-delete')),
        header: String(this.translateService.instant('admin.common.dialogs.delete')),
      },
    })

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) {
        return
      }
      try {
        this.spinnerService.show()

        if (this.id) {
          await this.adminService.deleteGroup(this.id)
        }

        this.snackbarService.message(String(this.translateService.instant('admin.group.messages.deleted')))
        await this.router.navigate(['/admin/groups'])
      } catch (_e) {
        this.snackbarService.error(String(this.translateService.instant('admin.group.messages.could-not-delete')))
      } finally {
        this.spinnerService.hide()
      }
    })
  }
}
