#!/usr/bin/env python3
"""Seed the development database with realistic dummy data.

Usage (from project root):
    ./seed.sh

Or manually:
    cd backend
    DATABASE_URL=postgresql://sitekeeper:sitekeeper@localhost:5434/sitekeeper \
        venv/bin/python seed_data.py

This script:
1. Drops all existing data (truncates all tables)
2. Creates a known user you can log in with
3. Populates job sites, jobs, contacts, estimates, invoices, notes,
   saved items, time entries, and business info

Login credentials after seeding:
    Email:    demo@sitekeeper.com
    Password: demo1234
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app import create_app
from app.extensions import bcrypt, db
from app.models import (
    BusinessInfo,
    Contact,
    DocumentFieldSettings,
    DocumentNumber,
    Estimate,
    Invoice,
    InvoiceStatusHistory,
    Job,
    JobSite,
    LineItem,
    LineItemEntry,
    Note,
    SavedItem,
    SavedItemEntry,
    TimeEntry,
    User,
    job_contacts,
    job_site_contacts,
)
from sqlalchemy import text


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEMO_EMAIL = "demo@sitekeeper.com"
DEMO_PASSWORD = "demo1234"

NOW = datetime.now(tz=timezone.utc)


def _ago(days=0, hours=0):
    """Helper: return a datetime N days/hours ago."""
    return NOW - timedelta(days=days, hours=hours)


def main():
    app = create_app()
    with app.app_context():
        print("Seeding database...")
        _truncate_all()
        _seed_all()
        print("\nDone! You can now log in with:")
        print(f"  Email:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")


def _truncate_all():
    """Remove all existing data."""
    print("  Truncating all tables...")
    tables = db.metadata.sorted_tables
    with db.engine.connect() as conn:
        conn.execute(text("SET session_replication_role = 'replica'"))
        for table in tables:
            conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))
        conn.execute(text("SET session_replication_role = 'origin'"))
        conn.commit()


def _seed_all():
    """Populate the database with realistic contractor data."""

    # ── User ─────────────────────────────────────────────────────────────
    print("  Creating users...")
    pw_hash = bcrypt.generate_password_hash(DEMO_PASSWORD).decode("utf-8")
    user = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        password_hash=pw_hash,
        name="Cameron Mitchell",
        phone="(303) 555-0147",
        role="admin",
        is_approved=True,
    )
    db.session.add(user)

    member = User(
        id=uuid.uuid4(),
        email="mike@sitekeeper.com",
        password_hash=pw_hash,
        name="Mike Torres",
        phone="(303) 555-0299",
        role="member",
        is_approved=True,
    )
    db.session.add(member)

    pending = User(
        id=uuid.uuid4(),
        email="pending@sitekeeper.com",
        password_hash=pw_hash,
        name="Sarah Pending",
        phone="(303) 555-0333",
        role="member",
        is_approved=False,
    )
    db.session.add(pending)
    db.session.flush()

    # ── Business Info ────────────────────────────────────────────────────
    print("  Creating business info...")
    biz = BusinessInfo(
        id=uuid.uuid4(),
        business_name="Mitchell Plumbing & Remodel",
        state="CO",
        payment_method="Venmo @mitchell-plumbing or check",
        business_address="4521 Pearl St, Boulder, CO 80302",
        business_phone="(303) 555-0147",
        business_email="info@mitchellplumbing.co",
        owner_user_id=user.id,
        default_hourly_rate=Decimal("85.00"),
    )
    db.session.add(biz)

    # ── Document Numbers ─────────────────────────────────────────────────
    est_num = DocumentNumber(id=uuid.uuid4(), document_type="estimate", next_number=1007)
    inv_num = DocumentNumber(id=uuid.uuid4(), document_type="invoice", next_number=2004)
    db.session.add_all([est_num, inv_num])
    db.session.flush()

    # ── Contacts ─────────────────────────────────────────────────────────
    print("  Creating contacts...")
    c_johnson = Contact(
        id=uuid.uuid4(), name="Robert Johnson",
        phone="(303) 555-8821", email="rjohnson@gmail.com",
        mailing_address="789 Spruce Dr, Boulder, CO 80302",
    )
    c_garcia = Contact(
        id=uuid.uuid4(), name="Maria Garcia",
        phone="(720) 555-4490", email="mgarcia@outlook.com",
        mailing_address="234 Walnut St, Longmont, CO 80501",
    )
    c_chen = Contact(
        id=uuid.uuid4(), name="David Chen",
        phone="(303) 555-6612", email="dchen@techcorp.io",
        notes="Property manager for TechCorp offices",
    )
    c_baker = Contact(
        id=uuid.uuid4(), name="Lisa Baker",
        phone="(720) 555-7733", email="lbaker@baker-rentals.com",
        mailing_address="890 Pine Ave, Denver, CO 80220",
        notes="Manages 12 rental properties",
    )
    c_patel = Contact(
        id=uuid.uuid4(), name="Raj Patel",
        phone="(303) 555-2201", email="raj@mountainview-hoa.org",
        notes="HOA president, Mountain View condos",
    )
    db.session.add_all([c_johnson, c_garcia, c_chen, c_baker, c_patel])
    db.session.flush()

    # ── Job Sites ────────────────────────────────────────────────────────
    print("  Creating job sites...")
    site_johnson = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Johnson Residence",
        description="Single family home, built 1985. Ongoing maintenance client.",
        address="789 Spruce Dr, Boulder, CO 80302",
        default_hourly_rate=Decimal("85.00"),
        primary_contact_id=c_johnson.id,
    )
    site_garcia = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Garcia Kitchen Renovation",
        description="Full kitchen remodel — cabinets, counters, plumbing, electrical.",
        address="234 Walnut St, Longmont, CO 80501",
        default_hourly_rate=Decimal("90.00"),
        primary_contact_id=c_garcia.id,
    )
    site_techcorp = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="TechCorp Office Building",
        description="Commercial property. 3-floor office. Restroom renovation project.",
        address="1200 Tech Park Blvd, Suite 100, Boulder, CO 80301",
        default_hourly_rate=Decimal("95.00"),
        primary_contact_id=c_chen.id,
    )
    site_baker = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Baker Rental Properties",
        description="Multiple rental units. Rotating maintenance and turnover work.",
        address="890 Pine Ave, Denver, CO 80220",
        default_hourly_rate=Decimal("80.00"),
        primary_contact_id=c_baker.id,
    )
    site_mountain = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Mountain View Condos",
        description="HOA-managed complex. Common area plumbing and unit work.",
        address="5600 Mountain View Rd, Boulder, CO 80303",
        default_hourly_rate=Decimal("85.00"),
        primary_contact_id=c_patel.id,
    )
    db.session.add_all([site_johnson, site_garcia, site_techcorp, site_baker, site_mountain])
    db.session.flush()

    # Link contacts to sites
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_johnson.id, contact_id=c_johnson.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_garcia.id, contact_id=c_garcia.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_techcorp.id, contact_id=c_chen.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_baker.id, contact_id=c_baker.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_mountain.id, contact_id=c_patel.id))
    db.session.flush()

    # ── Jobs ─────────────────────────────────────────────────────────────
    print("  Creating jobs...")
    # Johnson Residence jobs
    job_j_bath = Job(
        id=uuid.uuid4(), job_site_id=site_johnson.id,
        name="Master Bathroom Remodel", status="in_progress",
        description="Replace tub with walk-in shower, new vanity, re-tile floor.",
        default_hourly_rate=Decimal("85.00"),
        created_at=_ago(days=14),
    )
    job_j_leak = Job(
        id=uuid.uuid4(), job_site_id=site_johnson.id,
        name="Fix Kitchen Sink Leak", status="completed",
        description="Slow drip under kitchen sink. Replace P-trap and supply lines.",
        default_hourly_rate=Decimal("85.00"),
        finished_at=_ago(days=5),
        created_at=_ago(days=8),
    )
    job_j_heater = Job(
        id=uuid.uuid4(), job_site_id=site_johnson.id,
        name="Water Heater Replacement", status="pending",
        description="40-gal gas water heater is 15 years old, recommend tankless upgrade.",
        default_hourly_rate=Decimal("85.00"),
        created_at=_ago(days=2),
    )

    # Garcia Kitchen jobs
    job_g_plumb = Job(
        id=uuid.uuid4(), job_site_id=site_garcia.id,
        name="Kitchen Plumbing Rough-In", status="completed",
        description="Move supply and drain lines for new island sink location.",
        default_hourly_rate=Decimal("90.00"),
        finished_at=_ago(days=20),
        created_at=_ago(days=30),
    )
    job_g_fixtures = Job(
        id=uuid.uuid4(), job_site_id=site_garcia.id,
        name="Install Kitchen Fixtures", status="in_progress",
        description="Install farmhouse sink, pot filler, garbage disposal, dishwasher hookup.",
        default_hourly_rate=Decimal("90.00"),
        created_at=_ago(days=7),
    )

    # TechCorp jobs
    job_t_restroom = Job(
        id=uuid.uuid4(), job_site_id=site_techcorp.id,
        name="2nd Floor Restroom Renovation", status="in_progress",
        description="Demo existing fixtures, install low-flow toilets, touchless faucets, ADA compliance.",
        default_hourly_rate=Decimal("95.00"),
        created_at=_ago(days=21),
    )
    job_t_breakroom = Job(
        id=uuid.uuid4(), job_site_id=site_techcorp.id,
        name="Break Room Sink Install", status="pending",
        description="Add utility sink in 3rd floor break room. Tap into existing stack.",
        default_hourly_rate=Decimal("95.00"),
        created_at=_ago(days=3),
    )

    # Baker Rentals jobs
    job_b_unit4 = Job(
        id=uuid.uuid4(), job_site_id=site_baker.id,
        name="Unit 4 Turnover — Plumbing", status="completed",
        description="Replace all faucets, clean drains, fix running toilet.",
        default_hourly_rate=Decimal("80.00"),
        finished_at=_ago(days=10),
        created_at=_ago(days=15),
    )
    job_b_unit7 = Job(
        id=uuid.uuid4(), job_site_id=site_baker.id,
        name="Unit 7 Emergency — Burst Pipe", status="in_progress",
        description="Frozen pipe burst in north wall. Cut out, replace section, patch drywall.",
        default_hourly_rate=Decimal("80.00"),
        created_at=_ago(days=1),
    )

    # Mountain View jobs
    job_m_pool = Job(
        id=uuid.uuid4(), job_site_id=site_mountain.id,
        name="Pool House Plumbing", status="pending",
        description="New plumbing for pool house restroom and outdoor shower.",
        default_hourly_rate=Decimal("85.00"),
        created_at=_ago(days=4),
    )

    all_jobs = [
        job_j_bath, job_j_leak, job_j_heater,
        job_g_plumb, job_g_fixtures,
        job_t_restroom, job_t_breakroom,
        job_b_unit4, job_b_unit7,
        job_m_pool,
    ]
    db.session.add_all(all_jobs)
    db.session.flush()

    # ── Notes ────────────────────────────────────────────────────────────
    print("  Creating notes...")
    notes = [
        Note(id=uuid.uuid4(), job_id=job_j_bath.id,
             body="## Initial Assessment\n\n- Existing tub is cast iron, will need 2 people to remove\n- Subfloor looks solid from access panel\n- **Client wants frameless glass shower door**\n- Tile: large format 12x24 porcelain (client picking at store this week)\n\n### TODO\n- [ ] Order shower pan (custom 48x36)\n- [ ] Get glass quote from Front Range Glass\n- [ ] Schedule plumber for rough-in Tuesday",
             created_at=_ago(days=13)),
        Note(id=uuid.uuid4(), job_id=job_j_bath.id,
             body="## Day 1 Progress\n\nDemo complete. Removed tub, tile, and vanity. Found some water damage behind the tub wall — about 2 sqft of drywall needs replacing. Not structural.\n\nClient notified, added $150 for repair to estimate.",
             created_at=_ago(days=10)),
        Note(id=uuid.uuid4(), job_id=job_t_restroom.id,
             body="## ADA Requirements\n\n- Grab bars at toilet (36\" and 42\")\n- Wheelchair accessible stall (60\" turning radius)\n- Lever-handle faucets\n- Mirror max 40\" from floor\n\nBuilding inspector: Dave Martinez, (303) 555-0088",
             created_at=_ago(days=18)),
        Note(id=uuid.uuid4(), job_id=job_b_unit7.id,
             body="## Emergency Response\n\n**Arrived on-site 7:30 AM.** Water shut off by tenant. Burst is in the 2\" copper supply line inside the north exterior wall. About 18\" of pipe split from freezing.\n\nInsulation was insufficient — recommend adding foam board before closing wall.\n\n### Materials needed:\n- 2\" Type L copper (3 ft section)\n- ProPress couplings x2\n- Drywall patch kit\n- R-13 insulation batt",
             created_at=_ago(hours=20)),
    ]
    db.session.add_all(notes)
    db.session.flush()

    # ── Estimates ────────────────────────────────────────────────────────
    print("  Creating estimates with line items...")

    # Estimate 1: Bathroom Remodel (detailed, multiple line items)
    est_bath = Estimate(
        id=uuid.uuid4(), job_id=job_j_bath.id,
        title="Master Bathroom Remodel",
        delivered=True, tax_rate=Decimal("8.77"),
        document_number="1001", document_date=date.today() - timedelta(days=12),
        bill_to="Robert Johnson",
        company_name="Mitchell Plumbing & Remodel",
        user_name="Cameron Mitchell",
        user_phone="(303) 555-0147",
        user_email="info@mitchellplumbing.co",
        payment_method="Venmo @mitchell-plumbing or check",
        business_address="4521 Pearl St, Boulder, CO 80302",
        worksite_address="789 Spruce Dr, Boulder, CO 80302",
        notes="Estimate valid for 30 days. 50% deposit required to schedule work.",
        created_at=_ago(days=12),
    )
    db.session.add(est_bath)
    db.session.flush()

    # Line items for bathroom estimate
    li_demo = LineItem(id=uuid.uuid4(), parent_id=est_bath.id, parent_type="estimate",
                       name="Demolition", hourly_rate=Decimal("85.00"), sort_order=0)
    li_shower = LineItem(id=uuid.uuid4(), parent_id=est_bath.id, parent_type="estimate",
                         name="Walk-In Shower Install", hourly_rate=Decimal("85.00"), sort_order=1)
    li_vanity = LineItem(id=uuid.uuid4(), parent_id=est_bath.id, parent_type="estimate",
                         name="Vanity & Plumbing", hourly_rate=Decimal("85.00"), sort_order=2)
    li_tile = LineItem(id=uuid.uuid4(), parent_id=est_bath.id, parent_type="estimate",
                       name="Tile Work", hourly_rate=Decimal("85.00"), sort_order=3)
    db.session.add_all([li_demo, li_shower, li_vanity, li_tile])
    db.session.flush()

    # Entries for each line item
    entries_bath = [
        # Demolition
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_demo.id, entry_type="hours",
                      name="Tub & tile removal", hours=Decimal("6"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_demo.id, entry_type="fee",
                      name="Dumpster rental (1 day)", unit_price=Decimal("350.00"), quantity=Decimal("1"), sort_order=1),
        # Shower
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_shower.id, entry_type="material",
                      name="Custom shower pan (48x36)", unit_price=Decimal("420.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_shower.id, entry_type="material",
                      name="Frameless glass door", unit_price=Decimal("1250.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_shower.id, entry_type="material",
                      name="Delta rain showerhead", unit_price=Decimal("189.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_shower.id, entry_type="material",
                      name="Mixing valve (Moen Posi-Temp)", unit_price=Decimal("145.00"), quantity=Decimal("1"), sort_order=3),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_shower.id, entry_type="hours",
                      name="Plumbing rough-in & install", hours=Decimal("10"), sort_order=4),
        # Vanity
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_vanity.id, entry_type="material",
                      name="60\" double vanity w/ quartz top", unit_price=Decimal("1599.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_vanity.id, entry_type="material",
                      name="Widespread faucet (x2)", unit_price=Decimal("179.00"), quantity=Decimal("2"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_vanity.id, entry_type="hours",
                      name="Vanity install & plumbing hookup", hours=Decimal("4"), sort_order=2),
        # Tile
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_tile.id, entry_type="material",
                      name="Porcelain tile 12x24 (80 sqft)", unit_price=Decimal("4.50"), quantity=Decimal("80"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_tile.id, entry_type="material",
                      name="Thinset, grout, backer board", unit_price=Decimal("120.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_tile.id, entry_type="hours",
                      name="Floor & shower wall tiling", hours=Decimal("16"), sort_order=2),
    ]
    db.session.add_all(entries_bath)
    db.session.flush()

    # Estimate 2: Water Heater (simpler)
    est_heater = Estimate(
        id=uuid.uuid4(), job_id=job_j_heater.id,
        title="Tankless Water Heater Upgrade",
        delivered=False, tax_rate=Decimal("8.77"),
        document_number="1005", document_date=date.today() - timedelta(days=1),
        bill_to="Robert Johnson",
        company_name="Mitchell Plumbing & Remodel",
        user_name="Cameron Mitchell",
        worksite_address="789 Spruce Dr, Boulder, CO 80302",
        created_at=_ago(days=1),
    )
    db.session.add(est_heater)
    db.session.flush()

    li_heater = LineItem(id=uuid.uuid4(), parent_id=est_heater.id, parent_type="estimate",
                         name="Tankless Water Heater", hourly_rate=Decimal("85.00"), sort_order=0)
    db.session.add(li_heater)
    db.session.flush()

    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_heater.id, entry_type="material",
                      name="Rinnai RU199iN tankless unit", unit_price=Decimal("1649.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_heater.id, entry_type="material",
                      name="Venting kit & gas line materials", unit_price=Decimal("285.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_heater.id, entry_type="material",
                      name="Isolation valves & fittings", unit_price=Decimal("95.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_heater.id, entry_type="hours",
                      name="Remove old tank, install tankless", hours=Decimal("8"), sort_order=3),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_heater.id, entry_type="fee",
                      name="Permit fee", unit_price=Decimal("125.00"), quantity=Decimal("1"), sort_order=4),
    ])
    db.session.flush()

    # Estimate 3: TechCorp restroom (commercial)
    est_restroom = Estimate(
        id=uuid.uuid4(), job_id=job_t_restroom.id,
        title="2nd Floor ADA Restroom Renovation",
        delivered=True, tax_rate=Decimal("8.77"),
        document_number="1003", document_date=date.today() - timedelta(days=19),
        bill_to="David Chen — TechCorp",
        company_name="Mitchell Plumbing & Remodel",
        user_name="Cameron Mitchell",
        worksite_address="1200 Tech Park Blvd, Suite 100, Boulder, CO 80301",
        notes="Net 30 terms. Work to be performed outside business hours (6PM–6AM).",
        created_at=_ago(days=19),
    )
    db.session.add(est_restroom)
    db.session.flush()

    li_fixtures = LineItem(id=uuid.uuid4(), parent_id=est_restroom.id, parent_type="estimate",
                           name="Fixture Replacement", hourly_rate=Decimal("95.00"), sort_order=0)
    li_ada = LineItem(id=uuid.uuid4(), parent_id=est_restroom.id, parent_type="estimate",
                      name="ADA Compliance", hourly_rate=Decimal("95.00"), sort_order=1)
    db.session.add_all([li_fixtures, li_ada])
    db.session.flush()

    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_fixtures.id, entry_type="material",
                      name="Low-flow toilet (Toto Drake)", unit_price=Decimal("389.00"), quantity=Decimal("4"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_fixtures.id, entry_type="material",
                      name="Touchless faucet (Delta)", unit_price=Decimal("275.00"), quantity=Decimal("4"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_fixtures.id, entry_type="material",
                      name="Soap dispenser (auto)", unit_price=Decimal("89.00"), quantity=Decimal("4"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_fixtures.id, entry_type="hours",
                      name="Demo & install fixtures", hours=Decimal("20"), sort_order=3),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_ada.id, entry_type="material",
                      name="ADA grab bars (stainless)", unit_price=Decimal("65.00"), quantity=Decimal("6"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_ada.id, entry_type="material",
                      name="ADA-compliant mirror (x2)", unit_price=Decimal("120.00"), quantity=Decimal("2"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_ada.id, entry_type="hours",
                      name="Install ADA hardware & verify compliance", hours=Decimal("6"), sort_order=2),
    ])
    db.session.flush()

    # ── Invoices ─────────────────────────────────────────────────────────
    print("  Creating invoices...")

    # Invoice 1: Kitchen sink leak (paid)
    inv_leak = Invoice(
        id=uuid.uuid4(), job_id=job_j_leak.id,
        title="Kitchen Sink Repair",
        delivered=True, status="paid",
        tax_rate=Decimal("8.77"),
        document_number="2001", document_date=date.today() - timedelta(days=5),
        bill_to="Robert Johnson",
        company_name="Mitchell Plumbing & Remodel",
        user_name="Cameron Mitchell",
        user_phone="(303) 555-0147",
        payment_method="Venmo @mitchell-plumbing or check",
        worksite_address="789 Spruce Dr, Boulder, CO 80302",
        status_changed_at=_ago(days=3),
        created_at=_ago(days=5),
    )
    db.session.add(inv_leak)
    db.session.flush()

    li_leak = LineItem(id=uuid.uuid4(), parent_id=inv_leak.id, parent_type="invoice",
                       name="Sink Repair", hourly_rate=Decimal("85.00"), sort_order=0)
    db.session.add(li_leak)
    db.session.flush()
    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_leak.id, entry_type="material",
                      name="P-trap assembly", unit_price=Decimal("18.99"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_leak.id, entry_type="material",
                      name="Supply lines (braided SS)", unit_price=Decimal("12.50"), quantity=Decimal("2"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_leak.id, entry_type="material",
                      name="Plumber's putty & Teflon", unit_price=Decimal("8.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_leak.id, entry_type="hours",
                      name="Diagnosis & repair", hours=Decimal("1.5"), sort_order=3),
    ])

    # Status history for paid invoice
    db.session.add_all([
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_leak.id, status="drafting", changed_at=_ago(days=5)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_leak.id, status="sent_awaiting_payment", changed_at=_ago(days=5, hours=1)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_leak.id, status="paid", changed_at=_ago(days=3)),
    ])
    db.session.flush()

    # Invoice 2: Garcia rough-in (sent, awaiting payment)
    inv_garcia = Invoice(
        id=uuid.uuid4(), job_id=job_g_plumb.id,
        title="Kitchen Plumbing Rough-In",
        delivered=True, status="sent_awaiting_payment",
        tax_rate=Decimal("8.77"),
        document_number="2002", document_date=date.today() - timedelta(days=18),
        bill_to="Maria Garcia",
        company_name="Mitchell Plumbing & Remodel",
        user_name="Cameron Mitchell",
        worksite_address="234 Walnut St, Longmont, CO 80501",
        status_changed_at=_ago(days=15),
        created_at=_ago(days=18),
    )
    db.session.add(inv_garcia)
    db.session.flush()

    li_roughin = LineItem(id=uuid.uuid4(), parent_id=inv_garcia.id, parent_type="invoice",
                          name="Plumbing Rough-In", hourly_rate=Decimal("90.00"), sort_order=0)
    db.session.add(li_roughin)
    db.session.flush()
    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_roughin.id, entry_type="material",
                      name="3/4\" PEX tubing (100ft)", unit_price=Decimal("89.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_roughin.id, entry_type="material",
                      name="PEX fittings & crimp rings", unit_price=Decimal("45.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_roughin.id, entry_type="material",
                      name="2\" ABS drain pipe (20ft)", unit_price=Decimal("52.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_roughin.id, entry_type="hours",
                      name="Rough-in labor (relocate lines)", hours=Decimal("12"), sort_order=3),
    ])

    db.session.add_all([
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_garcia.id, status="drafting", changed_at=_ago(days=18)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_garcia.id, status="waiting_to_send", changed_at=_ago(days=17)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_garcia.id, status="sent_awaiting_payment", changed_at=_ago(days=15)),
    ])
    db.session.flush()

    # Invoice 3: Baker unit 4 (waiting to send)
    inv_baker = Invoice(
        id=uuid.uuid4(), job_id=job_b_unit4.id,
        title="Unit 4 Turnover — Plumbing Work",
        delivered=False, status="waiting_to_send",
        tax_rate=Decimal("8.77"),
        document_number="2003", document_date=date.today() - timedelta(days=9),
        bill_to="Lisa Baker — Baker Rental Properties",
        company_name="Mitchell Plumbing & Remodel",
        user_name="Cameron Mitchell",
        worksite_address="890 Pine Ave, Unit 4, Denver, CO 80220",
        status_changed_at=_ago(days=8),
        created_at=_ago(days=9),
    )
    db.session.add(inv_baker)
    db.session.flush()

    li_unit4 = LineItem(id=uuid.uuid4(), parent_id=inv_baker.id, parent_type="invoice",
                        name="Turnover Plumbing", hourly_rate=Decimal("80.00"), sort_order=0)
    db.session.add(li_unit4)
    db.session.flush()
    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_unit4.id, entry_type="material",
                      name="Kitchen faucet (Moen Adler)", unit_price=Decimal("79.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_unit4.id, entry_type="material",
                      name="Bathroom faucet (x2)", unit_price=Decimal("49.00"), quantity=Decimal("2"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_unit4.id, entry_type="material",
                      name="Toilet flapper & fill valve", unit_price=Decimal("22.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_unit4.id, entry_type="hours",
                      name="Replace fixtures & clear drains", hours=Decimal("4"), sort_order=3),
    ])

    db.session.add_all([
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_baker.id, status="drafting", changed_at=_ago(days=9)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_baker.id, status="waiting_to_send", changed_at=_ago(days=8)),
    ])
    db.session.flush()

    # ── Saved Items (Item Library) ───────────────────────────────────────
    print("  Creating saved items library...")

    si_toilet = SavedItem(
        id=uuid.uuid4(), user_id=user.id,
        name="Standard Toilet Swap",
        notes="Remove old toilet, install new. Includes wax ring and supply line.",
        hourly_rate=Decimal("85.00"),
    )
    si_faucet = SavedItem(
        id=uuid.uuid4(), user_id=user.id,
        name="Faucet Replacement (Kitchen)",
        notes="Standard single-hole kitchen faucet replacement.",
        hourly_rate=Decimal("85.00"),
    )
    si_disposal = SavedItem(
        id=uuid.uuid4(), user_id=user.id,
        name="Garbage Disposal Install",
        hourly_rate=Decimal("85.00"),
    )
    db.session.add_all([si_toilet, si_faucet, si_disposal])
    db.session.flush()

    db.session.add_all([
        # Toilet swap entries
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_toilet.id, entry_type="material",
                       name="Toilet (Toto Drake II)", unit_price=Decimal("389.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_toilet.id, entry_type="material",
                       name="Wax ring & bolts", unit_price=Decimal("8.50"), quantity=Decimal("1"), sort_order=1),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_toilet.id, entry_type="material",
                       name="Supply line (braided SS)", unit_price=Decimal("12.00"), quantity=Decimal("1"), sort_order=2),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_toilet.id, entry_type="hours",
                       name="Remove old, install new, test", hours=Decimal("2"), sort_order=3),
        # Faucet entries
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_faucet.id, entry_type="material",
                       name="Kitchen faucet (mid-range)", unit_price=Decimal("189.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_faucet.id, entry_type="material",
                       name="Supply lines & Teflon", unit_price=Decimal("15.00"), quantity=Decimal("1"), sort_order=1),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_faucet.id, entry_type="hours",
                       name="Remove & install faucet", hours=Decimal("1.5"), sort_order=2),
        # Disposal entries
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_disposal.id, entry_type="material",
                       name="InSinkErator Badger 5 (1/2 HP)", unit_price=Decimal("109.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_disposal.id, entry_type="material",
                       name="Discharge tube & fittings", unit_price=Decimal("18.00"), quantity=Decimal("1"), sort_order=1),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_disposal.id, entry_type="hours",
                       name="Install & test", hours=Decimal("1"), sort_order=2),
    ])

    # Standalone Materials Library entries
    db.session.add_all([
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="material", name="Teflon tape (roll)",
                       unit_price=Decimal("3.50"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="material", name="SharkBite 1/2\" coupling",
                       unit_price=Decimal("7.99"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="material", name="PVC cement + primer kit",
                       unit_price=Decimal("12.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="fee", name="After-hours surcharge",
                       unit_price=Decimal("75.00"), quantity=Decimal("1"), sort_order=0),
    ])
    db.session.flush()

    # ── Time Entries ─────────────────────────────────────────────────────
    print("  Creating time entries...")
    db.session.add_all([
        TimeEntry(id=uuid.uuid4(), job_id=job_j_bath.id, user_id=user.id,
                  hours=Decimal("6.5"), worked_at=_ago(days=10), note="Demo day"),
        TimeEntry(id=uuid.uuid4(), job_id=job_j_bath.id, user_id=user.id,
                  hours=Decimal("8"), worked_at=_ago(days=9), note="Plumbing rough-in"),
        TimeEntry(id=uuid.uuid4(), job_id=job_j_bath.id, user_id=user.id,
                  hours=Decimal("7.5"), worked_at=_ago(days=8), note="Shower pan & tiling start"),
        TimeEntry(id=uuid.uuid4(), job_id=job_j_bath.id, user_id=member.id,
                  hours=Decimal("6"), worked_at=_ago(days=10), note="Helped with demo"),
        TimeEntry(id=uuid.uuid4(), job_id=job_j_leak.id, user_id=user.id,
                  hours=Decimal("1.5"), worked_at=_ago(days=6), note="Sink repair"),
        TimeEntry(id=uuid.uuid4(), job_id=job_t_restroom.id, user_id=user.id,
                  hours=Decimal("8"), worked_at=_ago(days=18), note="Night shift — demo fixtures"),
        TimeEntry(id=uuid.uuid4(), job_id=job_t_restroom.id, user_id=user.id,
                  hours=Decimal("8"), worked_at=_ago(days=16), note="Night shift — install toilets & faucets"),
        TimeEntry(id=uuid.uuid4(), job_id=job_b_unit4.id, user_id=user.id,
                  hours=Decimal("4"), worked_at=_ago(days=11), note="Unit turnover"),
        # Active clock-in (no clock_out = still running)
        TimeEntry(id=uuid.uuid4(), job_id=job_b_unit7.id, user_id=user.id,
                  clock_in=_ago(hours=2), note="Emergency burst pipe"),
    ])
    db.session.flush()

    # ── Document Field Settings (defaults) ───────────────────────────────
    print("  Creating document settings...")
    db.session.add_all([
        DocumentFieldSettings(id=uuid.uuid4(), document_type="estimate",
                              field_key="payment_method", visibility="always_show", pdf_visible=True),
        DocumentFieldSettings(id=uuid.uuid4(), document_type="estimate",
                              field_key="notes", visibility="additional", pdf_visible=True),
        DocumentFieldSettings(id=uuid.uuid4(), document_type="invoice",
                              field_key="payment_method", visibility="always_show", pdf_visible=True),
        DocumentFieldSettings(id=uuid.uuid4(), document_type="invoice",
                              field_key="notes", visibility="additional", pdf_visible=True),
    ])
    db.session.flush()

    # ── Commit everything ────────────────────────────────────────────────
    db.session.commit()
    print("\n  Summary:")
    print(f"    Users: 3 (1 admin, 1 member, 1 pending)")
    print(f"    Job Sites: 5")
    print(f"    Jobs: 10 (3 completed, 4 in_progress, 3 pending)")
    print(f"    Contacts: 5")
    print(f"    Estimates: 3 (with detailed line items)")
    print(f"    Invoices: 3 (paid, sent, waiting)")
    print(f"    Notes: 4 (markdown)")
    print(f"    Saved Items: 3 (+ 4 standalone materials)")
    print(f"    Time Entries: 9 (including 1 active clock-in)")


if __name__ == "__main__":
    main()
