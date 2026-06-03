import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app.routes';
import { AppComponent } from './app.component';
import { HomeComponent } from './components/home/home.component';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { HomeComponentModule } from './components/home/home.module';
import { CommonModule } from '@angular/common';
import { CountryStatusModalComponent } from './components/country-status-modal/country-status-modal.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    CountryStatusModalComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    HomeComponentModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
