"use client"

export function VistaPrevia({ dt, maxWidth }: { dt: any; maxWidth?: number }) {
  const d = new Date(dt.fecha)
  const mw = maxWidth ?? 990

  return (
    <div style={{ fontFamily: "Arial,Helvetica,sans-serif", fontSize: "11px", color: "#333", backgroundColor: "#fff" }}>
      <div style={{ maxWidth: mw, margin: "0 auto", padding: 24, border: "1px solid #ccc" }}>

        {/* HEADER */}
        <div style={{ display: "grid", gridTemplateColumns: "28% 44% 28%", gap: 0, marginBottom: 20 }}>
          {/* Left */}
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 167, height: 140, margin: "0 auto 5px" }}>
              <img src="/images/logo_vista_previa.png" alt="Logo" style={{ width: "119%", height: "111%", objectFit: "contain" }} />
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.1 }}>
              <div style={{ color: "#1a1a60" }}>C.I. INTERNATIONAL</div>
              <div style={{ color: "#00a651", fontSize: 23, letterSpacing: 1 }}>FUELS</div>
            </div>
            <p style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase", marginTop: 8, marginBottom: 0, color: "#222" }}>IN GOD WE TRUST</p>
            <p style={{ fontSize: "9.5px", fontStyle: "italic", marginTop: 2, marginBottom: 0, color: "#444" }}>Your best choice when bunkering in Colombia</p>
          </div>

          {/* Center */}
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 25, fontWeight: "bold", margin: 0, color: "#00a651" }}>RECIBO DE SUMINISTRO</h1>
            <h2 style={{ fontSize: 23, fontWeight: "bold", marginTop: 1, marginBottom: 12, color: "#f39c12" }}>DELIVERY TICKET</h2>
            <div style={{ fontSize: "9.5px", color: "#444", lineHeight: 1.35 }}>
              <p style={{ margin: "0 0 8px" }}><strong style={{ display: "block", color: "#333" }}>Barranquilla Office</strong>Centro Empresarial Las Américas II - Calle 77B No 59-61 Suite 1101<br />Phone: +57 (5) 385 8620 - Mobile: (57) 3156831507<br />Colombia - South América</p>
              <p style={{ margin: "0 0 8px" }}><strong style={{ display: "block", color: "#333" }}>Cartagena Office</strong>Vía Mamonal Km 13 Zona Franca Isla 3 Sec. Pasacaballos<br />PBX: (57) (5) 693 2454 - Colombia - South América</p>
              <p style={{ margin: "0 0 8px" }}><strong style={{ display: "block", color: "#333" }}>Miami Office</strong>7900 Harbor Island Drive Suite 615 Northbay Village Miami Fl. 33141<br />Phone: (305) 629 3199 - Mobile: 786 477 0428 - United State of America</p>
              <p style={{ margin: "0 0 8px" }}><strong style={{ display: "block", color: "#333" }}>Buenaventura Office</strong>Carrera 5 A No. 1 - 13 PISO 3 - PBX (57) (2) 415120 - 2415121+<br />Mobile: (57) 316 4211589 - Buenaventura - Colombia<br />E-mail: manager@ciinternationalfuels.com - customerservice@ciinternationalfuels.com</p>
              <p style={{ margin: 0 }}><strong style={{ display: "block", color: "#333" }}>Santa Marta</strong>Zona Franca Industrial Patio 2 Phone: +57 (5) 430 4785 Mobile (57) 3156831507 Colombia - South América</p>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ border: "1.5px solid #27ae60", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ backgroundColor: "#e8f8f5", color: "#f39c12", textAlign: "center", fontWeight: "bold", padding: 5, fontSize: 12, borderBottom: "1.5px solid #27ae60" }}>FECHA / DATE</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", height: 35 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: "bold", color: "#27ae60", borderRight: "1.5px solid #27ae60" }}>DIA/DAY</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: "bold", color: "#27ae60", borderRight: "1.5px solid #27ae60" }}>MES/MONTH</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: "bold", color: "#27ae60" }}>AÑO/YEAR</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", height: 28, borderTop: "1px solid #27ae60" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 14 }}>{String(d.getDate()).padStart(2, "0")}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 14, borderLeft: "1px solid #27ae60", borderRight: "1px solid #27ae60" }}>{String(d.getMonth() + 1).padStart(2, "0")}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 14 }}>{d.getFullYear()}</div>
              </div>
            </div>
            <div style={{ border: "1.5px solid #27ae60", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", height: 48, paddingLeft: 12 }}>
              <span style={{ fontSize: 24, fontWeight: "bold", color: "#f39c12" }}>N. {dt.numero}</span>
            </div>
            <div style={{ border: "1.5px solid #27ae60", borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "flex-start", height: 35, padding: "4px 12px" }}>
              <span style={{ fontSize: 9, fontWeight: "bold", color: "#27ae60" }}>PUERTO / PORT: <span style={{ fontSize: 14, color: "#333", fontWeight: "normal" }}>{dt.puerto}</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 15, fontWeight: "bold", fontSize: 10, marginTop: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 25, height: 15, backgroundColor: "#00a651", display: "inline-block" }} /><span style={{ color: "#00a651" }}>ESPAÑOL</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 25, height: 15, backgroundColor: "#f39c12", display: "inline-block" }} /><span style={{ color: "#f39c12" }}>ENGLISH</span></div>
            </div>
          </div>
        </div>

        {/* CUSTOMER INFO */}
        <div style={{ border: "1.5px solid #27ae60", borderRadius: 12, padding: 12, marginBottom: 15 }}>
          <div style={{ borderBottom: "1px solid #27ae60", paddingBottom: 4, marginBottom: 10 }}>
            <span style={{ color: "#00a651", fontWeight: "bold" }}>INFORMACION DEL CLIENTE /</span>
            <span style={{ color: "#f39c12", fontWeight: "bold" }}> CUSTOMER INFORMATION</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>CLIENTE/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>CUSTOMER:</span></>} value={dt.cliente?.nombre} />
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>DIRECCION/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>ADDRESS:</span></>} value={dt.direccion} />
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>CIUDAD/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>CITY:</span></>} value={dt.ciudad} />
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>AGENTE/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>AGENT:</span></>} value={dt.agente} />
            </div>
            <div>
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>MOTONAVE/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>VESSEL:</span></>} value={dt.motonave} />
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>IMO/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>IMO:</span></>} value={dt.imo} />
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>BANDERA/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>FLAG:</span></>} value={dt.bandera} />
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>LUGAR DE SUMINISTRO/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>PLACE OF DELIVERY:</span></>} value={dt.lugarSuministro} />
            </div>
          </div>
        </div>

        {/* DELIVERY METHOD */}
        <div style={{ border: "1.5px solid #27ae60", borderRadius: 12, padding: 12, marginBottom: 15 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 10 }}>
                <span style={{ whiteSpace: "nowrap" }}>
                  <span style={{ color: "#00a651", fontWeight: "bold" }}>SUMINISTRO POR/</span>
                  <span style={{ color: "#f39c12", fontWeight: "bold" }}> DELIVERY BY:</span>
                </span>
                <span style={{ fontWeight: "bold" }}>{dt.tipoSuministro === "BARGE" ? "☑" : "☐"} BARGE</span>
                <span style={{ fontWeight: "bold" }}>{dt.tipoSuministro === "TRUCKS" ? "☑" : "☐"} TRUCKS</span>
              </div>
              {dt.tipoSuministro === "BARGE" && (
                <>
                  <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>BARCAZA/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>BARGE:</span></>} value={dt.barcaza?.nombre} />
                  <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>CAPITAN/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>CAPTAIN:</span></>} value={dt.capitan?.nombre} />
                  <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>REMOLCADOR/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>TUG BOAT:</span></>} value={dt.remolcador?.nombre} />
                </>
              )}
              {dt.tipoSuministro === "TRUCKS" && (
                <>
                  <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>PLACAS/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>LICENSE PLATE:</span></>} value={dt.vehiculo?.placa || dt.placas} />
                  <div style={{ marginTop: 15 }}>
                    <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>CONDUCTOR/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>DRIVER:</span></>} value={dt.conductor?.nombre || dt.conductorNombre} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* PRODUCT + SOUNDING | QUALITY */}
        <div style={{ display: "grid", gridTemplateColumns: "calc(50% - 7.5px) calc(50% - 7.5px)", gap: 15, marginBottom: 15 }}>
          <div style={{ border: "1.5px solid #27ae60", borderRadius: 12, padding: 12 }}>
            <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>PRODUCTO/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>PRODUCT:</span></>} value={dt.producto?.nombre} />
            <div style={{ marginTop: 15 }}>
              <LF label={<><span style={{ color: "#00a651", fontWeight: "bold" }}>CANTIDAD ENTREGADA/</span> <span style={{ color: "#f39c12", fontWeight: "bold" }}>DELIVERED QUANTITY:</span></>} value={`${Number(dt.cantidadEntregada)} ${dt.unidadMedida ?? "MT"}`} />
            </div>
            <div style={{ marginTop: 20, lineHeight: 2 }}>
              <div>
                <span style={{ color: "#00a651", fontWeight: "bold" }}>SONDEO ANTES/</span>
                <span style={{ color: "#f39c12", fontWeight: "bold" }}> SOUNDING BEFORE:</span>
                <span style={{ marginLeft: 16, fontWeight: "bold" }}>{dt.sondajeAntesRealizado === "SI" ? "☑ SI / YES" : dt.sondajeAntesRealizado === "NO" ? "☐ NO" : ""}</span>
                {dt.sondajeAntes != null && <span style={{ marginLeft: 8, fontSize: 10 }}>({Number(dt.sondajeAntes)})</span>}
              </div>
              <div>
                <span style={{ color: "#00a651", fontWeight: "bold" }}>SONDEO DESPUES/</span>
                <span style={{ color: "#f39c12", fontWeight: "bold" }}> SOUNDING AFTER:</span>
                <span style={{ marginLeft: 16, fontWeight: "bold" }}>{dt.sondajeDespuesRealizado === "SI" ? "☑ SI / YES" : dt.sondajeDespuesRealizado === "NO" ? "☐ NO" : ""}</span>
                {dt.sondajeDespues != null && <span style={{ marginLeft: 8, fontSize: 10 }}>({Number(dt.sondajeDespues)})</span>}
              </div>
              <div style={{ marginTop: 10, lineHeight: 1.3 }}>
                <span style={{ color: "#00a651", fontWeight: "bold" }}>SONDEO TESTIFICADO POR REPRESENTANTE DEL BARCO/<br />GAUGES WITNESSED BY SHIP'S REPRESENTATIVE:</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: "bold", marginLeft: 8 }}>{dt.sondajeTestificado === "SI" ? "☑ SI / YES" : dt.sondajeTestificado === "NO" ? "☐ NO" : ""}</span>
                </div>
              </div>
            </div>
          </div>

          {/* QUALITY */}
          <div style={{ border: "1.5px solid #27ae60", borderRadius: 12 }}>
            <div style={{ backgroundColor: "#e8f8f5", borderBottom: "1px solid #27ae60", padding: "6px 8px", textAlign: "center", fontSize: 11 }}>
              <span style={{ color: "#00a651", fontWeight: "bold" }}>CALIDAD/</span>
              <span style={{ color: "#f39c12", fontWeight: "bold" }}> QUALITY</span>
            </div>
            {[
              ["API /", "API", dt.api],
              ["GRAVEDAD ESPECIFICA /", "SPECIFIC GRAVITY:", dt.gravedadEspecifica],
              ["DENSIDAD /", "DENSITY AT 60°F:", dt.densidad],
              ["VISCOSIDAD /", "VISCOSITY AT:", dt.viscosidad],
              ["AZUFRE /", "SULPHUR %:", dt.azufre],
              ["AGUA /", "WATER %:", dt.agua],
              ["PUNTO CHISPA /", "FLASH POINT:", dt.puntoChispa],
              ["TEMPERATURA /", "TEMPERATURE:", dt.temperatura],
              ["OTRAS PROPIEDADES /", "OTHERS SPECS:", dt.otrasPropiedades],
            ].map((row, i) => {
              const val = row[2]
              const valStr = val != null ? String(val) : ""
              return (
                <div key={i} style={{ display: "flex", borderBottom: i < 8 ? "1px solid #27ae60" : "none" }}>
                  <div style={{ flex: 3, borderRight: "1px solid #27ae60", padding: "4px 6px", fontSize: 11, minHeight: 22 }}>
                    {row[0] && <span style={{ color: "#00a651", fontWeight: "bold" }}>{row[0]}</span>}
                    {row[1] && <span style={{ color: "#f39c12", fontWeight: "bold" }}> {row[1]}</span>}
                  </div>
                  <div style={{ flex: 2, padding: "4px 6px", fontSize: 11, minHeight: 22, fontWeight: 500 }}>
                    {valStr}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SAMPLES | TIME LOG */}
        <div style={{ display: "grid", gridTemplateColumns: "calc(48% - 7.5px) calc(52% - 7.5px)", gap: 15, marginBottom: 15 }}>
          {/* SAMPLES */}
          <div style={{ border: "1.5px solid #27ae60", borderRadius: 12 }}>
            <div style={{ backgroundColor: "#e8f8f5", borderBottom: "1px solid #27ae60", padding: "6px 8px", textAlign: "center", fontSize: 11 }}>
              <span style={{ color: "#00a651", fontWeight: "bold" }}>MUESTRAS /</span>
              <span style={{ color: "#f39c12", fontWeight: "bold" }}> SAMPLES:</span>
            </div>
            <div style={{ backgroundColor: "#e8f8f5", borderBottom: "1px solid #27ae60", display: "flex" }}>
              <div style={{ flex: 3, borderRight: "1px solid #27ae60", padding: "4px 8px", textAlign: "center", fontSize: 11 }}>
                <span style={{ color: "#00a651", fontWeight: "bold" }}>MUESTRAS RETENIDAS/</span>
                <span style={{ color: "#f39c12", fontWeight: "bold" }}> RETAINED SAMPLES:</span>
              </div>
              <div style={{ flex: 2, padding: "4px 8px", textAlign: "center", fontSize: 11 }}>
                <span style={{ color: "#00a651", fontWeight: "bold" }}>SELLO/</span>
                <span style={{ color: "#f39c12", fontWeight: "bold" }}> SEAL #</span>
              </div>
            </div>
            {[
              ["PROVEEDOR/", "SUPPLIER:", dt.selloProveedor],
              ["MOTONAVE/", "VESSEL:", dt.selloMotonave],
              ["MARPOL ANNEX VI:", "", dt.marpolAnnexVi],
              ["OTRA MUESTRA/", "OTHER SAMPLE:", dt.otraMuestra],
            ].map((row, i) => {
              const val = row[2]
              const valStr = val != null ? String(val) : ""
              return (
                <div key={i} style={{ display: "flex", borderBottom: "1px solid #27ae60" }}>
                  <div style={{ flex: 3, borderRight: "1px solid #27ae60", padding: "4px 6px", fontSize: 11, minHeight: 22 }}>
                    <span style={{ color: "#00a651", fontWeight: "bold" }}>{row[0]}</span>
                    {row[1] && <span style={{ color: "#f39c12", fontWeight: "bold" }}> {row[1]}</span>}
                  </div>
                  <div style={{ flex: 2, padding: "4px 6px", fontSize: 11, minHeight: 22, fontWeight: 500 }}>
                    {valStr}
                  </div>
                </div>
              )
            })}
            <div style={{ padding: "6px 8px", fontSize: 11, minHeight: 35 }}>
              <span style={{ color: "#00a651", fontWeight: "bold" }}>MUESTRAS ENTREGADAS AL CLIENTE/<br />SAMPLE GIVEN TO CUSTOMER</span>
            </div>
          </div>

          {/* TIME LOG */}
          <div style={{ border: "1.5px solid #27ae60", borderRadius: 12, overflow: "hidden" }}>
            <table cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#e8f8f5" }}>
                  <th style={{ border: "1px solid #27ae60", padding: "6px 8px", textAlign: "center", fontSize: 11 }}>
                    <span style={{ color: "#00a651", fontWeight: "bold" }}>ESTADO DE HECHOS /</span>
                    <span style={{ color: "#f39c12", fontWeight: "bold" }}> TIME LOG</span>
                  </th>
                  <th style={{ border: "1px solid #27ae60", padding: "6px 8px", textAlign: "center", fontSize: 11 }}>
                    <span style={{ color: "#00a651", fontWeight: "bold" }}>FECHA/</span>
                    <span style={{ color: "#f39c12", fontWeight: "bold" }}> DATE</span>
                  </th>
                  <th style={{ border: "1px solid #27ae60", padding: "6px 8px", textAlign: "center", fontSize: 11 }}>
                    <span style={{ color: "#00a651", fontWeight: "bold" }}>HORA/</span>
                    <span style={{ color: "#f39c12", fontWeight: "bold" }}> TIME</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BARCAZA ACORDERADA AL BUQUE /", "BARGE ALONGSIDE"],
                  ["MANGUERA CONECTADA /", "HOSE CONNECTED"],
                  ["INICIO BOMBEO /", "STARTED PUMPING"],
                  ["FINALIZACION BOMBEO /", "FINISHED PUMPING"],
                  ["BARCAZA LIBRE /", "BARGE AWAY"],
                ].map((row, i) => {
                  const matchEvent = dt.timeline?.find((t: any) => t.evento?.toLowerCase().includes(row[0].slice(0, 8).toLowerCase()))
                  return (
                    <tr key={i}>
                      <td style={{ border: "1px solid #27ae60", padding: "6px 8px", fontSize: 10 }}>
                        <span style={{ color: "#00a651", fontWeight: "bold" }}>{row[0]}</span>
                        <span style={{ color: "#f39c12", fontWeight: "bold" }}> {row[1]}</span>
                      </td>
                      <td style={{ border: "1px solid #27ae60", padding: "6px 8px", fontSize: 10, textAlign: "center" }}>
                        {matchEvent ? formatDate2(matchEvent.fecha) : ""}
                      </td>
                      <td style={{ border: "1px solid #27ae60", padding: "6px 8px", fontSize: 10, textAlign: "center" }}>
                        {matchEvent?.hora || ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* OBSERVATIONS */}
        <div style={{ border: "1.5px solid #27ae60", borderRadius: 12, padding: "10px 15px", marginBottom: 15, minHeight: 60 }}>
          <span style={{ color: "#00a651", fontWeight: "bold" }}>OBSERVACIONES/</span>
          <span style={{ color: "#f39c12", fontWeight: "bold" }}> REMARKS:</span>
          <p style={{ marginTop: 4, fontSize: 11, whiteSpace: "pre-wrap" }}>{dt.observaciones || ""}</p>
        </div>

        {/* LEGAL */}
        <div style={{ border: "1.5px solid #27ae60", borderRadius: 12, padding: "10px 15px", marginBottom: 15, fontSize: 10, textAlign: "justify", lineHeight: 1.4 }}>
          <strong>The product was supplied conforms with regulation 14 (1) and 18 (1) of marpol annex VI.</strong> The marine fuel described here in is delivered in accordance with <span style={{ color: "#f39c12", fontWeight: "bold" }}>C.I. International Fuels</span> Standard Terms and Conditions of Sales and on credit of the vessel. Any disclaimers is to the creation of a maritime lien in the amount of the purchase price and delivery charges and/or restrictions as to the authority of the ship's officer singing this receipt to bind the vessel and her owner to the aboe are null and void, unless an authorized representative of CI international Fuels. shall have otherwise agreed in writting at the time buyer initially orders the marine fuel. Falling such agrement, delivery shall, under no circumstances, constitute a waiber by CI International Fuels. of the above.
        </div>

        {/* SIGNATURES */}
        <div style={{ display: "grid", gridTemplateColumns: "32% 68%", border: "1.5px solid #27ae60", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, borderRight: "1.5px solid #27ae60" }}>
            <div style={{ borderBottom: "1px solid #27ae60", paddingBottom: 4, marginBottom: 10, fontSize: 11 }}>
              <span style={{ color: "#00a651", fontWeight: "bold" }}>COMPAÑIA QUE ENTREGA/</span>
              <span style={{ color: "#f39c12", fontWeight: "bold" }}>DELIVERYING COMPANY:</span>
            </div>
            <p style={{ fontSize: 11, fontWeight: 500, marginTop: 8 }}>{dt.companiaEntrega || ""}</p>
            <p style={{ fontSize: 11, fontWeight: 500 }}>{dt.verificadoPor || ""}</p>
            {(() => {
              const firmaProv = dt.firmas?.find((f: any) => f.rol === "REPRESENTANTE_PROVEEDOR")
              return (
                <div style={{ textAlign: "center", marginTop: firmaProv ? 15 : 50 }}>
                  {firmaProv?.firma && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={firmaProv.firma} alt="Firma representante" style={{ maxHeight: 40, display: "block", margin: "0 auto" }} />
                    </div>
                  )}
                  {firmaProv?.sello && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={firmaProv.sello} alt="Sello" style={{ maxHeight: 40, display: "block", margin: "0 auto" }} />
                    </div>
                  )}
                  <div style={{ borderBottom: "1px solid #27ae60", width: "85%", margin: "0 auto 4px" }} />
                  <span style={{ color: "#00a651", fontWeight: "bold" }}>NOMBRE REPRESENTANTE/<br />REPRESENTATIVE NAME:</span>
                  <p style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>
                    {firmaProv?.nombre || ""}
                  </p>
                </div>
              )
            })()}
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ textAlign: "center", borderBottom: "1px solid #27ae60", paddingBottom: 4, marginBottom: 10 }}>
              <span style={{ color: "#f39c12", fontWeight: "bold" }}>DECLARATION OF MASTER OF CHIEF ENGINEER</span>
            </div>
            <p style={{ fontSize: 9, margin: 0, textAlign: "justify", color: "#555" }}>
              I delare that the information given above is true and correct to the best of my knowledge and belief; that I have know are edges of the facts set forth here in; that the articles discribed inthis notice of lading were received in the quanties stated from the person and on the date. indicated above; that said articles were laders on the vessel named above of use on said vessel as supplies, except as noted. received for use as benkers, together with representative sample, the quantities shown above. Exact quantities show are subjetc to correction in case of error.
            </p>
            {(() => {
              const firmaCapitan = dt.firmas?.find((f: any) => f.rol === "CAPITAN" || f.rol === "JEFE_MAQUINAS")
              return (
                <div style={{ textAlign: "center", marginTop: firmaCapitan ? 10 : 25 }}>
                  {firmaCapitan?.firma && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={firmaCapitan.firma} alt="Firma capitán" style={{ maxHeight: 40, display: "block", margin: "0 auto" }} />
                    </div>
                  )}
                  {firmaCapitan?.sello && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={firmaCapitan.sello} alt="Sello" style={{ maxHeight: 40, display: "block", margin: "0 auto" }} />
                    </div>
                  )}
                  <div style={{ borderBottom: "1px solid #27ae60", width: "70%", margin: "0 auto 4px" }} />
                  <span style={{ color: "#00a651", fontWeight: "bold" }}>FIRMA Y SELLO CAPITAN O JEFE MAQUINA/<br />SING AND STAMP OF MASTER OFR CHIEF ENGINNER</span>
                  {firmaCapitan?.nombre && (
                    <p style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>{firmaCapitan.nombre}</p>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate2(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function LF({ label, value }: { label: React.ReactNode; value?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 8 }}>
      <span style={{ whiteSpace: "nowrap", marginRight: 4, fontSize: 11 }}>{label}</span>
      <div style={{ borderBottom: "1px solid #27ae60", flexGrow: 1, height: 15 }} />
      {value != null && value !== "" && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 500 }}>{value}</span>}
    </div>
  )
}
