# nu associates — MOM PDF Generator v2
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import os

# ── COLOURS
NAVY   = colors.HexColor('#1D3D62')
STEEL  = colors.HexColor('#657B90')
LIGHT  = colors.HexColor('#f5f3ef')
BLACK  = colors.HexColor('#1a1a1a')
WHITE  = colors.white
BORDER = colors.HexColor('#CCCCCC')
AMBER  = colors.HexColor('#fff3cd')
GREEN  = colors.HexColor('#d4edda')
AMBER_T= colors.HexColor('#856404')
GREEN_T= colors.HexColor('#155724')

W, H = A4

def s(size=8, bold=False, color=BLACK, align=TA_LEFT):
    return ParagraphStyle('', fontName='Helvetica-Bold' if bold else 'Helvetica',
        fontSize=size, textColor=color, alignment=align,
        leading=size*1.35, spaceAfter=0, spaceBefore=0)

def p(text, size=8, bold=False, color=BLACK, align=TA_LEFT):
    return Paragraph(str(text), s(size, bold, color, align))

def cell(items, bg=WHITE, pad=4):
    return items

FULL_W = 180*mm

def generate_mom(data, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm)
    story = []

    # ── HEADER — logo left, title centre, details right
    logo_path = '/home/claude/logo.png'
    logo = Image(logo_path, width=32*mm, height=16*mm) if os.path.exists(logo_path) else p('nu associates', 10, True, NAVY)

    # Right info block
    info = Table([
        [p('DATE',     7, True, STEEL), p(data['date'],     7)],
        [p('CLIENT',   7, True, STEEL), p(data['client'],   7)],
        [p('LOCATION', 7, True, STEEL), p(data['location'], 7)],
    ], colWidths=[18*mm, 42*mm])
    info.setStyle(TableStyle([
        ('TOPPADDING',    (0,0),(-1,-1), 2),
        ('BOTTOMPADDING', (0,0),(-1,-1), 2),
        ('LEFTPADDING',   (0,0),(-1,-1), 3),
        ('RIGHTPADDING',  (0,0),(-1,-1), 3),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
    ]))

    # Title block
    mom_num  = data.get('mom_number','1')
    title_tbl = Table([
        [p(f'MINUTES OF MEETING — {mom_num} (MOM)', 14, True, NAVY, TA_CENTER)],
        [p(data['project'], 8, False, STEEL, TA_CENTER)],
    ], colWidths=[110*mm])
    title_tbl.setStyle(TableStyle([
        ('TOPPADDING',    (0,0),(-1,-1), 3),
        ('BOTTOMPADDING', (0,0),(-1,-1), 3),
        ('ALIGN',         (0,0),(-1,-1), 'CENTER'),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
    ]))

    hdr = Table([[logo, title_tbl, info]], colWidths=[35*mm, 110*mm, 35*mm])
    hdr.setStyle(TableStyle([
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
        ('INNERGRID',     (0,0),(-1,-1), 0.3, BORDER),
        ('BACKGROUND',    (0,0),(-1,-1), LIGHT),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
        ('ALIGN',         (0,0),(0,0),   'CENTER'),
        ('TOPPADDING',    (0,0),(-1,-1), 6),
        ('BOTTOMPADDING', (0,0),(-1,-1), 6),
        ('LEFTPADDING',   (0,0),(-1,-1), 4),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 4*mm))

    # ── PARTICIPANTS
    story.append(p('PARTICIPANTS', 9, True, NAVY))
    story.append(Spacer(1, 1.5*mm))

    pt = Table(
        [[p('SL NO',7,True,WHITE,TA_CENTER), p('NAME',7,True,WHITE), p('COMPANY',7,True,WHITE), p('STATUS',7,True,WHITE)]] +
        [[p(str(i+1),8,False,BLACK,TA_CENTER), p(x['name']), p(x['company']), p(x.get('status','Present'))]
         for i,x in enumerate(data['participants'])],
        colWidths=[14*mm, 62*mm, 72*mm, 32*mm], repeatRows=1)
    pt.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,0),  NAVY),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [WHITE, LIGHT]),
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
        ('INNERGRID',     (0,0),(-1,-1), 0.3, BORDER),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0),(-1,-1), 3), ('BOTTOMPADDING',(0,0),(-1,-1), 3),
        ('LEFTPADDING',   (0,0),(-1,-1), 4),
    ]))
    story.append(pt)
    story.append(Spacer(1, 4*mm))

    # ── ITEMS TABLE
    story.append(p('MINUTES OF MEETING', 9, True, NAVY))
    story.append(Spacer(1, 1.5*mm))

    col_w = [12*mm, 77*mm, 32*mm, 46*mm, 13*mm]
    rows = [[
        p('SL\nNO', 7, True, WHITE, TA_CENTER),
        p('DESCRIPTION', 7, True, WHITE),
        p('RESPONSIBLE /\nDECISION', 7, True, WHITE, TA_CENTER),
        p('REMARKS / ACTION', 7, True, WHITE),
        p('STATUS', 7, True, WHITE, TA_CENTER),
    ]]

    ts = [
        ('BACKGROUND',    (0,0),(-1,0),  NAVY),
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
        ('INNERGRID',     (0,0),(-1,-1), 0.3, BORDER),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0),(-1,-1), 4),
        ('BOTTOMPADDING', (0,0),(-1,-1), 4),
        ('LEFTPADDING',   (0,0),(-1,-1), 4),
        ('RIGHTPADDING',  (0,0),(-1,-1), 4),
    ]

    for i, item in enumerate(data['items']):
        row_i   = i + 1
        status  = item.get('status', 'Open')
        is_open = status == 'Open'
        bg      = LIGHT if i % 2 == 0 else WHITE
        ts.append(('BACKGROUND', (0,row_i), (-1,row_i), bg))
        ts.append(('BACKGROUND', (4,row_i), (4,row_i),  AMBER if is_open else GREEN))
        rows.append([
            p(str(item['sl']), 8, False, BLACK, TA_CENTER),
            p(item['description'], 8),
            p(item.get('responsible','NU'), 8, False, BLACK, TA_CENTER),
            p(item.get('remarks',''), 8),
            p(status, 7, True, AMBER_T if is_open else GREEN_T, TA_CENTER),
        ])

    mt = Table(rows, colWidths=col_w, repeatRows=1)
    mt.setStyle(TableStyle(ts))
    story.append(mt)
    story.append(Spacer(1, 5*mm))

    # ── FOOTER NOTE
    nt = Table([[p('Note:  This report is being sent electronically. '
        'Please revert within 48 hours for any clarification, '
        'else this is deemed accepted by all stakeholders.', 7)]], colWidths=[FULL_W])
    nt.setStyle(TableStyle([
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
        ('BACKGROUND',    (0,0),(-1,-1), LIGHT),
        ('TOPPADDING',    (0,0),(-1,-1), 4), ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING',   (0,0),(-1,-1), 6),
    ]))
    story.append(nt)
    story.append(Spacer(1, 4*mm))

    # ── SIGNATURE BLOCK
    sig = Table([
        [p('Prepared by', 7, True, STEEL),    p('Acknowledged by', 7, True, STEEL)],
        [Spacer(1, 10*mm),                     Spacer(1, 10*mm)],
        [p('NU Associates LLP', 8, True),      p(data['client'], 8, True)],
        [p('1st Floor, No.940, Shantha Complex', 7, False, STEEL),  p('', 7)],
        [p('20th Main Rd, BSK 2nd Stage, Bengaluru 560070', 7, False, STEEL), p('', 7)],
    ], colWidths=[90*mm, 90*mm])
    sig.setStyle(TableStyle([
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
        ('INNERGRID',     (0,0),(-1,-1), 0.3, BORDER),
        ('BACKGROUND',    (0,0),(-1,-1), LIGHT),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0),(-1,-1), 4), ('BOTTOMPADDING',(0,0),(-1,-1), 3),
        ('LEFTPADDING',   (0,0),(-1,-1), 6),
        ('LINEBELOW',     (0,1),(-1,1),  0.5, BORDER),
    ]))
    story.append(sig)

    doc.build(story)
    print(f'✓ MOM PDF: {output_path}')


if __name__ == '__main__':
    data = {
        'mom_number': '4',
        'client':   'TLD MAINI GSE PVT LTD',
        'project':  'PV 90 Production Line Works — TLD Phase II Basement, Nelamangala',
        'location': 'Site — Nelamangala, Bengaluru',
        'date':     '18 April 2026',
        'participants': [
            {'name':'Mr. Nagaprasad',    'company':'TLD Maini GSE Pvt Ltd'},
            {'name':'Mr. Naveen K Bhat', 'company':'NU Associates LLP'},
            {'name':'Mr. Murugesan K',   'company':'NU Associates LLP'},
            {'name':'Mr. Anjaneya',      'company':'Site Manager — NU Associates'},
        ],
        'items': [
            {'sl':1, 'description':'HVAC — Both ductable indoor units (5.5 TR and 16.5 TR) suspended and level in production bay. Refrigerant pipe connections not yet made. Copper pipe material received on site.',
             'responsible':'NU / HVAC Vendor', 'remarks':'Karthik to confirm refrigerant pipe routing before drain is fixed. Target: 21 Apr.', 'status':'Open'},
            {'sl':2, 'description':'Interior — Al glass partition frame fixed and plumb across full bay length. Glass panels installed with protective tape. 8mm gap at column C4 junction to be packed.',
             'responsible':'NU', 'remarks':'Vendor to pack gap at column C4 with appropriate filler before handover. Rajani to review.', 'status':'Open'},
            {'sl':3, 'description':'Interior — False ceiling grid alignment off by 25mm in Zone B near column C4. Will affect tile sitting and joint alignment if not corrected.',
             'responsible':'NU', 'remarks':'Vendor to reset Zone B grid. Do not proceed with tile laying in Zone B until corrected. Target: 19 Apr.', 'status':'Open'},
            {'sl':4, 'description':'Fire / Suppression — Hydrant pipe fixing in progress at ceiling level. Red GI pipes laid and supported. Sprinkler drop points not yet installed.',
             'responsible':'NU / Fire Vendor', 'remarks':'Murugesan to confirm sprinkler vendor mobilisation date. Hose reel drum delivery pending.', 'status':'Open'},
            {'sl':5, 'description':'IT / Networking — 15U wall mount rack fixed to east wall of storage room. FA conduit drops and cable tray in place. Rack currently empty — cabling pending.',
             'responsible':'NU / IT Vendor', 'remarks':'Karthik to confirm data cabling schedule with IT vendor. Target mobilisation: 22 Apr.', 'status':'Open'},
            {'sl':6, 'description':'Electrical — Wiring drops hanging loose from ceiling opening in UPS room. Back boxes not yet fixed. DB location on north wall confirmed per drawing E-201 R2.',
             'responsible':'NU', 'remarks':'Electrical vendor to fix back boxes and terminate wiring before partition closure. Do not close ceiling until complete.', 'status':'Open'},
            {'sl':7, 'description':'Civil — Ramp extension masonry complete and plastered. Load bank enclosure masonry and corrugated metal canopy fixed. Painting not yet done.',
             'responsible':'NU', 'remarks':'Civil vendor to take up painting after full cure — minimum 14 days from plaster. Target: 28 Apr.', 'status':'Open'},
            {'sl':8, 'description':'LT Panel rework (125A to 160A feeder) — Change Notice CN001 approved. Electrical vendor to proceed with panel modification.',
             'responsible':'NU / Electrical Vendor', 'remarks':'Modification to be completed before main DB energisation. Target: 25 Apr.', 'status':'Open'},
        ]
    }
    generate_mom(data, '/home/claude/PV90_MOM_4_18Apr2026.pdf')

# CLI entry point — called from generate-weekly-mom.js
if __name__ == '__main__' and len(__import__('sys').argv) == 3:
    import json, sys
    data_file   = sys.argv[1]
    output_file = sys.argv[2]
    with open(data_file) as f:
        data = json.load(f)
    generate_mom(data, output_file)
