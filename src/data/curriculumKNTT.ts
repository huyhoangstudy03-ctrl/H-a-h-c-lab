export interface CurriculumTopic {
  id: string;
  grade: 10 | 11 | 12;
  chapterNumber: string;
  title: string;
  summary: string;
  keyPoints: string[];
  keyEquations: string[];
  examTips: string;
  relatedReactionId?: string;
}

export const CURRICULUM_KNTT: CurriculumTopic[] = [
  // LỚP 10 - KẾT NỐI TRI THỨC
  {
    id: 'k10_c1',
    grade: 10,
    chapterNumber: 'Chương 1 (Lớp 10)',
    title: 'Cấu tạo nguyên tử',
    summary: 'Thành phần nguyên tử (p, n, e), hạt nhân, đồng vị, nguyên tử khối trung bình, lớp và phân lớp electron.',
    keyPoints: [
      'Số hiệu nguyên tử Z = số p = số e. Số khối A = Z + N.',
      'Nguyên tử khối trung bình: Ā = (a·A₁ + b·A₂) / 100.',
      'Thứ tự mức năng lượng: 1s 2s 2p 3s 3p 4s 3d 4p...; viết cấu hình electron theo từng lớp.',
      'Lớp ngoài cùng có 1, 2, 3 e thường là kim loại; 5, 6, 7 e thường là phi kim; 8 e (hoặc 2 ở He) là khí hiếm.',
    ],
    keyEquations: [
      'Z = P = E; A = Z + N',
      '1 amu = 1,6605 × 10⁻²⁴ g',
      'Số e tối đa trên phân lớp s, p, d, f lần lượt là 2, 6, 10, 14',
    ],
    examTips: 'Lưu ý cấu hình đặc biệt bán bão hòa/bão hòa phân lớp d: Cr (Z=24): [Ar]3d⁵4s¹; Cu (Z=29): [Ar]3d¹⁰4s¹.',
  },
  {
    id: 'k10_c2',
    grade: 10,
    chapterNumber: 'Chương 2 (Lớp 10)',
    title: 'Bảng tuần hoàn các nguyên tố hóa học',
    summary: 'Nguyên tắc sắp xếp, cấu tạo bảng tuần hoàn (ô, chu kì, nhóm) và quy luật biến đổi tuần hoàn tính chất.',
    keyPoints: [
      'Số thứ tự ô = Z; Số thứ tự chu kì = số lớp electron; Nhóm A = tổng số electron lớp ngoài cùng.',
      'Trong một chu kì (trái → phải): bán kính giảm, độ âm điện và tính phi kim tăng, tính kim loại giảm.',
      'Trong một nhóm A (trên → dưới): bán kính tăng, độ âm điện và tính phi kim giảm, tính kim loại tăng.',
      'Tính bazơ của oxit/hiđroxit biến đổi cùng chiều tính kim loại; tính axit cùng chiều tính phi kim.',
    ],
    keyEquations: [
      'Oxit cao nhất nhóm R (hóa trị n): R₂Oₙ (với n lẻ) hoặc ROₙ/₂ (với n chẵn)',
      'Hợp chất khí với H của phi kim nhóm VA–VIIA: RH₈₋ₙ',
    ],
    examTips: 'F (Flo) có độ âm điện lớn nhất (3,98) nên luôn chỉ có số oxi hóa -1 trong mọi hợp chất.',
  },
  {
    id: 'k10_c3',
    grade: 10,
    chapterNumber: 'Chương 3 (Lớp 10)',
    title: 'Liên kết hóa học',
    summary: 'Quy tắc Octet, liên kết ion, liên kết cộng hóa trị (không cực, phân cực, cho nhận), liên kết hydrogen và tương tác van der Waals.',
    keyPoints: [
      'Hiệu độ âm điện Δχ: 0 ≤ Δχ < 0,4 (Cộng hóa trị không cực); 0,4 ≤ Δχ < 1,7 (CHT phân cực); Δχ ≥ 1,7 (Liên kết ion).',
      'Liên kết σ (xen phủ trục) bền hơn liên kết π (xen phủ bên). Liên kết đôi gồm 1σ + 1π; liên kết ba gồm 1σ + 2π.',
      'Liên kết hydrogen (H-F, H-O, H-N) làm tăng mạnh nhiệt độ sôi và độ tan trong nước (như H₂O, NH₃, C₂H₅OH).',
    ],
    keyEquations: [
      'Na (2,8,1) + Cl (2,8,7) → Na⁺Cl⁻ (mạng tinh thể ion bền vững)',
      'N₂: N≡N (1 liên kết σ và 2 liên kết π, năng lượng liên kết rất lớn)',
    ],
    examTips: 'Nhiệt độ sôi: H₂O > HF > NH₃ > CH₄ nhờ liên kết hydrogen liên phân tử.',
  },
  {
    id: 'k10_c4',
    grade: 10,
    chapterNumber: 'Chương 4 (Lớp 10)',
    title: 'Phản ứng oxi hóa – khử',
    summary: 'Quy tắc xác định số oxi hóa, chất khử, chất oxi hóa và phương pháp thăng bằng electron.',
    keyPoints: [
      'Chất khử cho electron (số oxi hóa tăng - quá trình oxi hóa). Chất oxi hóa nhận electron (số oxi hóa giảm - quá trình khử).',
      '4 bước cân bằng thăng bằng electron: (1) Xác định số oxi hóa thay đổi → (2) Viết quá trình oxi hóa/khử → (3) Nhân hệ số sao cho Σe cho = Σe nhận → (4) Đặt hệ số vào phương trình và kiểm tra.',
    ],
    keyEquations: [
      'Cu + 4HNO₃ (đặc) → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O',
      '2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂↑ + 8H₂O',
    ],
    examTips: 'Nhớ câu thần chú: "Khử cho - O nhận" và cân bằng thứ tự: Kim loại → Phi kim → Hiđro → Oxi.',
    relatedReactionId: 'cu_hno3',
  },
  {
    id: 'k10_c5_c6',
    grade: 10,
    chapterNumber: 'Chương 5 & 6 (Lớp 10)',
    title: 'Năng lượng hóa học & Tốc độ phản ứng',
    summary: 'Biến thiên enthalpy chuẩn ΔᵣH°₂₉₈, phản ứng tỏa nhiệt/thu nhiệt, tốc độ trung bình và các yếu tố ảnh hưởng.',
    keyPoints: [
      'ΔᵣH°₂₉₈ < 0: Phản ứng tỏa nhiệt; ΔᵣH°₂₉₈ > 0: Phản ứng thu nhiệt.',
      'Tính theo nhiệt tạo thành chuẩn: ΔᵣH°₂₉₈ = ΣΔfH°(sản phẩm) − ΣΔfH°(chất đầu).',
      'Tính theo năng lượng liên kết: ΔᵣH°₂₉₈ = ΣE_b(chất đầu) − ΣE_b(sản phẩm).',
      '5 yếu tố tăng tốc độ phản ứng: Nồng độ, Nhiệt độ (quy tắc Van\'t Hoff v₂/v₁ = γ^((T₂-T₁)/10)), Áp suất (chất khí), Diện tích bề mặt, Chất xúc tác.',
    ],
    keyEquations: [
      'v_tb = ± ΔC / Δt',
      'v = k · C_A^a · C_B^b (Định luật tác dụng khối lượng)',
    ],
    examTips: 'Chất xúc tác làm giảm năng lượng hoạt hóa E_a, giúp phản ứng nhanh hơn nhưng không bị tiêu hao và không làm chuyển dịch cân bằng.',
    relatedReactionId: 'caco3_hcl',
  },
  {
    id: 'k10_c7',
    grade: 10,
    chapterNumber: 'Chương 7 (Lớp 10)',
    title: 'Nguyên tố nhóm VIIA (Halogen)',
    summary: 'Tính chất vật lí, hóa học của F₂, Cl₂, Br₂, I₂, hydrogen halide (HX) và nhận biết ion halide.',
    keyPoints: [
      'Từ F₂ → I₂: màu đậm dần (vàng lục nhạt → vàng lục → nâu đỏ → tím đen), nhiệt độ nóng chảy/sôi tăng, tính oxi hóa giảm dần.',
      'Halogen mạnh đẩy halogen yếu hơn ra khỏi dung dịch muối: Cl₂ + 2NaBr → 2NaCl + Br₂.',
      'Tính axit của HX tăng dần: HF (axit yếu) < HCl < HBr < HI.',
      'Nhận biết ion halide bằng AgNO₃: AgF tan; AgCl↓ trắng; AgBr↓ vàng nhạt; AgI↓ vàng đậm.',
    ],
    keyEquations: [
      'Cl₂ + 2NaOH → NaCl + NaClO + H₂O (nước Javel)',
      'AgNO₃ + NaCl → AgCl↓ + NaNO₃',
    ],
    examTips: 'HF ăn mòn thủy tinh nhờ phản ứng với SiO₂: SiO₂ + 4HF → SiF₄↑ + 2H₂O.',
    relatedReactionId: 'agno3_nacl',
  },

  // LỚP 11 - KẾT NỐI TRI THỨC
  {
    id: 'k11_c1',
    grade: 11,
    chapterNumber: 'Chương 1 (Lớp 11)',
    title: 'Cân bằng hóa học & Sự điện li',
    summary: 'Phản ứng thuận nghịch, hằng số cân bằng Kc, nguyên lí Le Chatelier, thuyết Brønsted-Lowry về acid-base, pH và chuẩn độ.',
    keyPoints: [
      'Hằng số cân bằng Kc chỉ phụ thuộc vào nhiệt độ (và bản chất phản ứng), không phụ thuộc nồng độ hay áp suất.',
      'Nguyên lí Le Chatelier: tăng T chuyển dịch theo chiều thu nhiệt (ΔH > 0); tăng P chuyển dịch về phía ít mol khí hơn.',
      'Theo Brønsted–Lowry: Acid là chất cho proton (H⁺), Base là chất nhận proton (H⁺).',
      'pH = -lg[H⁺]. pH < 7 (môi trường acid), pH = 7 (trung tính), pH > 7 (kiềm). Tích số ion của nước ở 25°C: [H⁺][OH⁻] = 10⁻¹⁴.',
    ],
    keyEquations: [
      'K_c = ([C]^c · [D]^d) / ([A]^a · [B]^b)',
      'pH + pOH = 14 (ở 25°C)',
      'Chuẩn độ acid-base: C_A · V_A = C_B · V_B (đơn chức)',
    ],
    examTips: 'Trong biểu thức Kc, không đưa nồng độ chất rắn nguyên chất vào.',
  },
  {
    id: 'k11_c2',
    grade: 11,
    chapterNumber: 'Chương 2 (Lớp 11)',
    title: 'Nitrogen & Sulfur',
    summary: 'Đơn chất N₂, NH₃, muối ammonium, HNO₃, hiện tượng phú dưỡng, S, SO₂, H₂SO₄ loãng và đặc.',
    keyPoints: [
      'N₂ trơ ở nhiệt độ thường do liên kết ba N≡N rất bền (Eb = 945 kJ/mol).',
      'Tổng hợp NH₃ (Haber-Bosch): N₂ + 3H₂ ⇌ 2NH₃ (ΔH < 0, xúc tác Fe, 400-450°C, 200 bar).',
      'HNO₃ là axit mạnh và oxi hóa mạnh, oxi hóa được hầu hết kim loại (trừ Au, Pt). Fe, Al, Cr bị thụ động hóa trong HNO₃ đặc nguội và H₂SO₄ đặc nguội.',
      'H₂SO₄ đặc có tính háo nước (than hóa đường saccarozơ) và tính oxi hóa mạnh; nhận biết SO₄²⁻ bằng Ba²⁺ tạo BaSO₄↓ trắng.',
    ],
    keyEquations: [
      'NH₄⁺ + OH⁻ → NH₃↑ + H₂O (nhận biết muối amoni)',
      'C₁₂H₂₂O₁₁ —(H₂SO₄ đặc)→ 12C + 11H₂O',
      'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
    ],
    examTips: 'Khi pha loãng H₂SO₄ đặc, phải rót từ từ axit vào nước và khuấy nhẹ — tuyệt đối không làm ngược lại.',
    relatedReactionId: 'bacl2_h2so4',
  },
  {
    id: 'k11_c3_c4',
    grade: 11,
    chapterNumber: 'Chương 3 & 4 (Lớp 11)',
    title: 'Đại cương Hóa Hữu Cơ & Hydrocarbon',
    summary: 'Nhóm chức, phổ hồng ngoại IR, phổ khối MS, đồng phân, danh pháp IUPAC, Alkane, Alkene, Alkyne và Arene.',
    keyPoints: [
      'Phổ MS cho biết phân tử khối (peak ion phân tử M⁺). Phổ IR giúp nhận diện nhóm chức (-OH vùng 3300 cm⁻¹, C=O vùng 1700 cm⁻¹).',
      'Alkane (CₙH₂ₙ₊₂): chỉ có liên kết đơn σ, phản ứng thế halogen theo cơ chế gốc tự do, cracking và reforming.',
      'Alkene (CₙH₂ₙ): có 1 nối đôi C=C, làm mất màu dung dịch Br₂, KMnO₄; cộng HX theo quy tắc Markovnikov.',
      'Alkyne (CₙH₂ₙ₋₂): alk-1-yne (như axetilen HC≡CH) tạo kết tủa vàng với AgNO₃/NH₃.',
      'Arene (Benzen C₆H₆): dễ thế, khó cộng, bền với chất oxi hóa (toluen mất màu KMnO₄ khi đun nóng).',
    ],
    keyEquations: [
      'CH≡CH + 2[Ag(NH₃)₂]OH → AgC≡CAg↓ (vàng) + 2NH₃ + 2H₂O',
      'CH₂=CH₂ + Br₂ → CH₂Br-CH₂Br',
    ],
    examTips: 'Lưu ý quy tắc gọi tên IUPAC mới theo CT GDPT 2018 (ví dụ: methane, ethene, ethyne, benzene, ethanol).',
  },
  {
    id: 'k11_c5_c6',
    grade: 11,
    chapterNumber: 'Chương 5 & 6 (Lớp 11)',
    title: 'Alcohol, Phenol, Carbonyl & Carboxylic Acid',
    summary: 'Tính chất vật lí, hóa học của dẫn xuất halogen, ancol, phenol, anđehit, xeton và axit cacboxylic.',
    keyPoints: [
      'Alcohol bậc I oxi hóa bởi CuO/t° tạo aldehyde; bậc II tạo ketone; alcohol đa chức có 2 nhóm -OH kề nhau hòa tan Cu(OH)₂ tạo phức xanh lam thẫm.',
      'Phenol (C₆H₅OH) có tính axit yếu (không đổi màu quỳ tím nhưng tan trong NaOH) và tạo kết tủa trắng 2,4,6-tribromophenol với nước Br₂.',
      'Aldehyde (-CHO) tham gia phản ứng tráng bạc với thuốc thử Tollens [Ag(NH₃)₂]OH và tạo kết tủa đỏ gạch Cu₂O với Cu(OH)₂/OH⁻, t°.',
      'Carboxylic acid (-COOH) làm quỳ tím hóa đỏ, giải phóng CO₂ từ NaHCO₃/CaCO₃, phản ứng ester hóa với alcohol.',
    ],
    keyEquations: [
      'R-CHO + 2[Ag(NH₃)₂]OH —t°→ R-COONH₄ + 2Ag↓ + 3NH₃ + H₂O',
      'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O (H₂SO₄ đặc, t°)',
    ],
    examTips: 'Thử nghiệm iodoform (I₂/NaOH) tạo kết tủa vàng CHI₃ dùng nhận biết nhóm CH₃-CO- hoặc CH₃-CH(OH)-.',
    relatedReactionId: 'ch3cooh_c2h5oh',
  },

  // LỚP 12 - KẾT NỐI TRI THỨC
  {
    id: 'k12_c1_c2',
    grade: 12,
    chapterNumber: 'Chương 1 & 2 (Lớp 12)',
    title: 'Ester – Lipid & Carbohydrate',
    summary: 'Phản ứng thủy phân este trong môi trường axit/kiềm, chất béo, xà phòng hóa; Glucose, Fructose, Saccharose, Tinh bột, Cellulose.',
    keyPoints: [
      'Thủy phân este trong kiềm (xà phòng hóa) là phản ứng một chiều tạo muối của carboxylic acid và alcohol.',
      'Glucose và Fructose (C₆H₁₂O₆) đều có phản ứng tráng bạc (fructose chuyển hóa thành glucose trong môi trường kiềm) và hòa tan Cu(OH)₂ tạo phức xanh lam.',
      'Saccharose (C₁₂H₂₂O₁₁) không tráng bạc nhưng hòa tan Cu(OH)₂; Tinh bột tạo màu xanh tím đặc trưng với dung dịch I₂.',
      'Cellulose không tan trong nước, tan trong nước Schweizer [Cu(NH₃)₄](OH)₂.',
    ],
    keyEquations: [
      'RCOOR\' + NaOH —t°→ RCOONa + R\'OH',
      '(C₆H₁₀O₅)ₙ + nH₂O —(H⁺, t°)→ nC₆H₁₂O₆',
    ],
    examTips: 'Chỉ số xà phòng hóa / phản ứng với Cu(OH)₂ giúp phân biệt nhanh monosaccharide và polysaccharide.',
  },
  {
    id: 'k12_c3_c4',
    grade: 12,
    chapterNumber: 'Chương 3 & 4 (Lớp 12)',
    title: 'Hợp chất chứa Nitrogen & Polymer',
    summary: 'Amine, Amino acid (tính lưỡng tính, điểm đẳng điện), Peptide (phản ứng màu biuret), Protein và vật liệu Polymer.',
    keyPoints: [
      'Amine có tính bazơ: alkylamine (như CH₃NH₂) làm xanh quỳ tím; aniline (C₆H₅NH₂) lực bazơ rất yếu không đổi màu quỳ, tạo kết tủa trắng với nước Br₂.',
      'Amino acid vừa có nhóm -NH₂ vừa có -COOH nên có tính lưỡng tính, tồn tại ở dạng ion lưỡng cực.',
      'Peptide có từ 2 liên kết peptide trở lên (tripeptide trở lên) cho phản ứng màu biuret tím đặc trưng với Cu(OH)₂/OH⁻.',
      'Polymer điều chế bằng phản ứng trùng hợp (PE, PP, PVC, cao su buna) hoặc trùng ngưng (Nylon-6,6, tơ lapsan).',
    ],
    keyEquations: [
      'H₂N-CH₂-COOH + HCl → ClH₃N-CH₂-COOH',
      'nCH₂=CH-Cl —(t°, p, xt)→ (-CH₂-CHCl-)ₙ (PVC)',
    ],
    examTips: 'Dipeptide chỉ có 1 liên kết peptide nên KHÔNG cho phản ứng màu biuret.',
  },
  {
    id: 'k12_c5',
    grade: 12,
    chapterNumber: 'Chương 5 (Lớp 12)',
    title: 'Pin điện & Điện phân',
    summary: 'Cặp oxi hóa - khử, thế điện cực chuẩn E°, sức điện động chuẩn của pin Galvani và quá trình điện phân.',
    keyPoints: [
      'Quy tắc alpha: chất oxi hóa mạnh hơn oxi hóa chất khử mạnh hơn sinh ra chất oxi hóa yếu hơn và chất khử yếu hơn.',
      'Sức điện động chuẩn của pin: E°_pin = E°_catot (+) − E°_anot (−) > 0.',
      'Tại Catot (-): luôn xảy ra quá trình khử (cation hoặc H₂O nhận electron). Tại Anot (+): luôn xảy ra quá trình oxi hóa (anion, H₂O hoặc điện cực tan nhường electron).',
      'Định luật Faraday: m = (A · I · t) / (n · F) với F = 96485 C/mol.',
    ],
    keyEquations: [
      'Pin Zn–Cu: Zn + Cu²⁺ → Zn²⁺ + Cu (E°_pin = 0,34 − (-0,76) = 1,10 V)',
      '2CuSO₄ + 2H₂O —(đpdd)→ 2Cu + O₂↑ + 2H₂SO₄',
    ],
    examTips: 'Thứ tự điện phân catot: Ag⁺ > Fe³⁺ > Cu²⁺ > H⁺ > Fe²⁺ > Zn²⁺ > H₂O (kim loại từ Al³⁺ trở về trước không bị điện phân trong dung dịch).',
    relatedReactionId: 'zn_cuso4',
  },
  {
    id: 'k12_c6_c7_c8',
    grade: 12,
    chapterNumber: 'Chương 6, 7 & 8 (Lớp 12)',
    title: 'Đại cương Kim loại, Nhóm IA–IIA & Kim loại Chuyển tiếp',
    summary: 'Tính chất kim loại, ăn mòn điện hóa, tách kim loại, kim loại kiềm/kiềm thổ, nước cứng và phức chất dãy chuyển tiếp thứ nhất.',
    keyPoints: [
      '3 phương pháp tách kim loại: Nhiệt luyện (sau Al: Zn, Fe, Cu), Thủy luyện (Cu, Ag), Điện phân nóng chảy (IA, IIA, Al).',
      'Ăn mòn điện hóa cần 3 điều kiện: 2 điện cực khác bản chất, tiếp xúc trực tiếp/qua dây dẫn, cùng tiếp xúc dung dịch chất điện li.',
      'Nước cứng chứa nhiều Ca²⁺, Mg²⁺ (tạm thời chứa HCO₃⁻; vĩnh cửu chứa Cl⁻, SO₄²⁻). Làm mềm bằng Na₂CO₃, Na₃PO₄ hoặc trao đổi ion.',
      'Kim loại chuyển tiếp dãy thứ nhất (Sc → Cu) có nhiều số oxi hóa và tạo phức chất bát diện/tứ diện có màu đặc trưng như [Cu(H₂O)₆]²⁺ xanh lam, [Cu(NH₃)₄(H₂O)₂]²⁺ xanh thẫm.',
    ],
    keyEquations: [
      '2Na + 2H₂O → 2NaOH + H₂↑',
      'Ca(HCO₃)₂ —t°→ CaCO₃↓ + CO₂↑ + H₂O (làm mềm nước cứng tạm thời)',
    ],
    examTips: 'Trong phức chất [Cu(NH₃)₄]²⁺, Cu²⁺ là nguyên tử trung tâm và 4 phân tử NH₃ là phối tử.',
    relatedReactionId: 'na_h2o',
  },
];
