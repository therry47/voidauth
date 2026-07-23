import { Component, inject, signal, type OnInit, ChangeDetectionStrategy } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { MaterialModule } from '../../material-module'
import { TotpInputComponent } from '../../components/totp-input/totp-input.component'
import { AuthService } from '../../services/auth.service'
import { SpinnerService } from '../../services/spinner.service'
import { SnackbarService } from '../../services/snackbar.service'
import { HttpErrorResponse } from '@angular/common/http'
import { TranslatePipe, TranslateService } from '@ngx-translate/core'

@Component({
  selector: 'app-totp-register',
  imports: [MaterialModule, TotpInputComponent, TranslatePipe],
  templateUrl: './totp-register.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './totp-register.component.scss',
})
export class TotpRegisterComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<TotpRegisterComponent>)
  readonly data = inject<{ enableMfa?: boolean } | undefined>(MAT_DIALOG_DATA)

  secret = signal<string | undefined>(undefined)
  uri = signal<string | undefined>(undefined)
  disabled = signal<boolean>(true)

  private spinnerService = inject(SpinnerService)
  private snackbarService = inject(SnackbarService)
  private authService = inject(AuthService)
  private translateService = inject(TranslateService)

  async ngOnInit(): Promise<void> {
    this.spinnerService.show()
    this.disabled.set(true)
    try {
      const totpOptions = await this.authService.registerTotp()
      this.secret.set(totpOptions.secret)
      this.uri.set(totpOptions.uri)
    } catch (e) {
      console.error(e)
      this.snackbarService.error(String(this.translateService.instant('totp-register.messages.could-not-get-info')))
      this.dialogRef.close(false)
    } finally {
      this.spinnerService.hide()
      this.disabled.set(false)
    }
  }

  async verifyToken(token: string) {
    this.spinnerService.show()
    this.disabled.set(true)
    try {
      await this.authService.verifyTotp(token, !!this.data?.enableMfa)
      this.dialogRef.close(true)
    } catch (e) {
      console.error(e)
      if (e instanceof HttpErrorResponse && e.status === 401) {
        this.snackbarService.error(String(this.translateService.instant('totp-register.messages.invalid-code')))
      } else {
        const mfaKey = this.data?.enableMfa ? 'totp-register.messages.could-not-enable-mfa' : 'totp-register.messages.could-not-add'
        this.snackbarService.error(String(this.translateService.instant(mfaKey)))
      }
    } finally {
      this.spinnerService.hide()
      this.disabled.set(false)
    }
  }
}
