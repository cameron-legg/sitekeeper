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
    Email:    demo@jobsyte.app
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

DEMO_EMAIL = "demo@jobsyte.app"
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
        name="Jake Hammer",
        phone="123-456-7890",
        role="admin",
        is_approved=True,
    )
    db.session.add(user)

    member = User(
        id=uuid.uuid4(),
        email="mike@jobsyte.app",
        password_hash=pw_hash,
        name="Mike Wrench",
        phone="123-456-7891",
        role="member",
        is_approved=True,
    )
    db.session.add(member)

    pending = User(
        id=uuid.uuid4(),
        email="sarah@jobsyte.app",
        password_hash=pw_hash,
        name="Sarah Newbie",
        phone="123-456-7892",
        role="member",
        is_approved=False,
    )
    db.session.add(pending)
    db.session.flush()

    # ── Business Info ────────────────────────────────────────────────────
    print("  Creating business info...")
    biz = BusinessInfo(
        id=uuid.uuid4(),
        business_name="Hammer Time Plumbing & Remodel",
        state="CO",
        payment_method="Venmo @hammer-time-plumbing or check",
        business_address="123 Fake Street, Nowhereville, CO 00001",
        business_phone="123-456-7890",
        business_email="info@jobsyte.app",
        owner_user_id=user.id,
        default_hourly_rate=Decimal("85.00"),
    )
    db.session.add(biz)

    # ── Document Numbers ─────────────────────────────────────────────────
    est_num = DocumentNumber(id=uuid.uuid4(), document_type="estimate", next_number=1008)
    inv_num = DocumentNumber(id=uuid.uuid4(), document_type="invoice", next_number=2006)
    db.session.add_all([est_num, inv_num])
    db.session.flush()

    # ── Contacts ─────────────────────────────────────────────────────────
    print("  Creating contacts...")
    c_johnson = Contact(
        id=uuid.uuid4(), name="Bob Homeowner",
        phone="123-456-7801", email="bob@jobsyte.app",
        mailing_address="100 Imaginary Blvd, Faketown, CO 00010",
    )
    c_garcia = Contact(
        id=uuid.uuid4(), name="Maria Kitchenson",
        phone="123-456-7802", email="maria@jobsyte.app",
        mailing_address="200 Madeup Lane, Nowhere, CO 00020",
    )
    c_chen = Contact(
        id=uuid.uuid4(), name="David Officepark",
        phone="123-456-7803", email="david@jobsyte.app",
        notes="Property manager for FakeCorp offices",
    )
    c_baker = Contact(
        id=uuid.uuid4(), name="Lisa Landlord",
        phone="123-456-7804", email="lisa@jobsyte.app",
        mailing_address="300 Nonexistent Ave, Ghostville, CO 00030",
        notes="Manages 12 rental properties",
    )
    c_patel = Contact(
        id=uuid.uuid4(), name="Raj Condoman",
        phone="123-456-7805", email="raj@jobsyte.app",
        notes="HOA president, Fictional Heights condos",
    )
    db.session.add_all([c_johnson, c_garcia, c_chen, c_baker, c_patel])
    db.session.flush()

    # Additional contacts
    c_flores = Contact(
        id=uuid.uuid4(), name="Tony Pipefitter",
        phone="123-456-7806", email="tony@jobsyte.app",
        mailing_address="42 Nowhere Court, Inventedburg, CO 00060",
        notes="Subcontractor — handles gas line work",
    )
    c_williams = Contact(
        id=uuid.uuid4(), name="Diane Wallboard",
        phone="123-456-7807", email="diane@jobsyte.app",
        mailing_address="77 Pretend Place, Samplecity, CO 00070",
        notes="Drywall and paint subcontractor",
    )
    c_nguyen = Contact(
        id=uuid.uuid4(), name="Hank Tilesworth",
        phone="123-456-7808", email="hank@jobsyte.app",
        notes="Tile specialist, does backsplash and shower work",
    )
    c_martinez = Contact(
        id=uuid.uuid4(), name="Elena Permitz",
        phone="123-456-7809", email="elena@jobsyte.app",
        mailing_address="1 Bureaucracy Blvd, Permitville, CO 00080",
        notes="City permits office contact",
    )
    c_oconnor = Contact(
        id=uuid.uuid4(), name="Paddy Sparks",
        phone="123-456-7810", email="paddy@jobsyte.app",
        notes="Electrician — licensed, handles all our electrical sub-work",
    )
    db.session.add_all([c_flores, c_williams, c_nguyen, c_martinez, c_oconnor])
    db.session.flush()

    # ── Job Sites ────────────────────────────────────────────────────────
    print("  Creating job sites...")
    site_johnson = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Homeowner Residence",
        description="Single family home, built 1985. Ongoing maintenance client.",
        address="100 Imaginary Blvd, Faketown, CO 00010",
        default_hourly_rate=Decimal("85.00"),
        primary_contact_id=c_johnson.id,
    )
    site_garcia = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Kitchenson Kitchen Renovation",
        description="Full kitchen remodel — cabinets, counters, plumbing, electrical.",
        address="200 Madeup Lane, Nowhere, CO 00020",
        default_hourly_rate=Decimal("90.00"),
        primary_contact_id=c_garcia.id,
    )
    site_techcorp = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="FakeCorp Office Building",
        description="Commercial property. 3-floor office. Restroom renovation project.",
        address="999 Placeholder Pkwy, Suite 100, Testburg, CO 00040",
        default_hourly_rate=Decimal("95.00"),
        primary_contact_id=c_chen.id,
    )
    site_baker = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Landlord Rental Properties",
        description="Multiple rental units. Rotating maintenance and turnover work.",
        address="300 Nonexistent Ave, Ghostville, CO 00030",
        default_hourly_rate=Decimal("80.00"),
        primary_contact_id=c_baker.id,
    )
    site_mountain = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Fictional Heights Condos",
        description="HOA-managed complex. Common area plumbing and unit work.",
        address="500 Unicorn Ridge Rd, Imaginaryville, CO 00050",
        default_hourly_rate=Decimal("85.00"),
        primary_contact_id=c_patel.id,
    )
    db.session.add_all([site_johnson, site_garcia, site_techcorp, site_baker, site_mountain])
    db.session.flush()

    # Additional job sites
    site_sparks = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Sparks Electric Co-op",
        description="Shared workspace building. Plumbing for 2 restrooms + kitchen.",
        address="888 Totally Real Rd, Exampletown, CO 00090",
        default_hourly_rate=Decimal("90.00"),
        primary_contact_id=c_oconnor.id,
    )
    site_flores = JobSite(
        id=uuid.uuid4(), user_id=user.id,
        name="Flores New Construction",
        description="Ground-up residential build. Plumbing rough-in through finish.",
        address="1 Blueprint Way, Constructia, CO 00100",
        default_hourly_rate=Decimal("95.00"),
        primary_contact_id=c_flores.id,
    )
    db.session.add_all([site_sparks, site_flores])
    db.session.flush()

    # Link contacts to sites
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_johnson.id, contact_id=c_johnson.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_garcia.id, contact_id=c_garcia.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_techcorp.id, contact_id=c_chen.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_baker.id, contact_id=c_baker.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_mountain.id, contact_id=c_patel.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_sparks.id, contact_id=c_oconnor.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_flores.id, contact_id=c_flores.id))
    # Cross-link subcontractors
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_garcia.id, contact_id=c_nguyen.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_techcorp.id, contact_id=c_martinez.id))
    db.session.execute(job_site_contacts.insert().values(job_site_id=site_flores.id, contact_id=c_williams.id))
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

    # Sparks Electric Co-op jobs
    job_s_restroom = Job(
        id=uuid.uuid4(), job_site_id=site_sparks.id,
        name="Ground Floor Restroom Refit", status="in_progress",
        description="Replace aging fixtures, add ADA-compliant stall. Building is 1970s.",
        default_hourly_rate=Decimal("90.00"),
        created_at=_ago(days=6),
    )
    job_s_kitchen = Job(
        id=uuid.uuid4(), job_site_id=site_sparks.id,
        name="Shared Kitchen Upgrade", status="pending",
        description="Add second sink, replace garbage disposal, install commercial dishwasher hookup.",
        default_hourly_rate=Decimal("90.00"),
        created_at=_ago(days=2),
    )

    # Flores New Construction jobs
    job_f_roughin = Job(
        id=uuid.uuid4(), job_site_id=site_flores.id,
        name="Whole-House Plumbing Rough-In", status="in_progress",
        description="All supply and DWV for 3-bed, 2.5-bath new construction.",
        default_hourly_rate=Decimal("95.00"),
        created_at=_ago(days=25),
    )
    job_f_finish = Job(
        id=uuid.uuid4(), job_site_id=site_flores.id,
        name="Finish Plumbing & Fixtures", status="pending",
        description="Set all toilets, sinks, tub, shower valves after drywall complete.",
        default_hourly_rate=Decimal("95.00"),
        created_at=_ago(days=3),
    )
    job_f_gas = Job(
        id=uuid.uuid4(), job_site_id=site_flores.id,
        name="Gas Line Rough-In", status="completed",
        description="Run gas lines to furnace, water heater, range, and dryer. Pressure test.",
        default_hourly_rate=Decimal("95.00"),
        finished_at=_ago(days=12),
        created_at=_ago(days=18),
    )

    all_jobs = [
        job_j_bath, job_j_leak, job_j_heater,
        job_g_plumb, job_g_fixtures,
        job_t_restroom, job_t_breakroom,
        job_b_unit4, job_b_unit7,
        job_m_pool,
        job_s_restroom, job_s_kitchen,
        job_f_roughin, job_f_finish, job_f_gas,
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
             body="## ADA Requirements\n\n- Grab bars at toilet (36\" and 42\")\n- Wheelchair accessible stall (60\" turning radius)\n- Lever-handle faucets\n- Mirror max 40\" from floor\n\nBuilding inspector: Dave Fakename, 123-456-7899",
             created_at=_ago(days=18)),
        Note(id=uuid.uuid4(), job_id=job_b_unit7.id,
             body="## Emergency Response\n\n**Arrived on-site 7:30 AM.** Water shut off by tenant. Burst is in the 2\" copper supply line inside the north exterior wall. About 18\" of pipe split from freezing.\n\nInsulation was insufficient — recommend adding foam board before closing wall.\n\n### Materials needed:\n- 2\" Type L copper (3 ft section)\n- ProPress couplings x2\n- Drywall patch kit\n- R-13 insulation batt",
             created_at=_ago(hours=20)),
        Note(id=uuid.uuid4(), job_id=job_f_roughin.id,
             body="## Plumbing Layout Notes\n\n- Master bath on 2nd floor — need to coordinate with HVAC for chase locations\n- Kitchen island sink requires underslab drain run (get survey before pouring)\n- **PEX-A with Uponor fittings per spec**\n- Whole-house manifold in utility room\n\n### Inspection Schedule\n- [ ] Underground rough — before slab pour\n- [ ] Above-ground rough — before drywall\n- [ ] Final — after fixtures set",
             created_at=_ago(days=22)),
        Note(id=uuid.uuid4(), job_id=job_f_gas.id,
             body="## Gas Pressure Test — PASSED\n\nTested at 30 PSI for 15 minutes. No drop. Inspector signed off.\n\n**Inspector:** Elena Permitz (123-456-7809)\n**Permit #:** FAKE-2024-00042",
             created_at=_ago(days=13)),
        Note(id=uuid.uuid4(), job_id=job_s_restroom.id,
             body="## Scope Clarification\n\nOwner wants to keep existing tile if possible. Only replacing:\n- 2 toilets (swap to Toto Drake)\n- 2 sinks + faucets\n- Expand one stall for ADA\n\nWall tile in good condition — just need to patch where grab bars go.\n\nBudget is tight — keep material selections mid-range.",
             created_at=_ago(days=5)),
        Note(id=uuid.uuid4(), job_id=job_g_fixtures.id,
             body="## Fixture Selections (confirmed)\n\n| Item | Model | Cost |\n|------|-------|------|\n| Sink | Kraus Farmhouse 33\" | $349 |\n| Faucet | Delta Trinsic pull-down | $279 |\n| Disposal | InSinkErator Evolution | $189 |\n| Pot filler | installed above range | $225 |\n\nAll items ordered — ETA Thursday.",
             created_at=_ago(days=4)),
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
        bill_to="Bob Homeowner",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        user_phone="123-456-7890",
        user_email="info@jobsyte.app",
        payment_method="Venmo @hammer-time-plumbing or check",
        business_address="123 Fake Street, Nowhereville, CO 00001",
        worksite_address="100 Imaginary Blvd, Faketown, CO 00010",
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
        bill_to="Bob Homeowner",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        worksite_address="100 Imaginary Blvd, Faketown, CO 00010",
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
        bill_to="David Officepark — FakeCorp",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        worksite_address="999 Placeholder Pkwy, Suite 100, Testburg, CO 00040",
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

    # Estimate 4: New Construction Rough-In
    est_newcon = Estimate(
        id=uuid.uuid4(), job_id=job_f_roughin.id,
        title="Whole-House Plumbing Rough-In",
        delivered=True, tax_rate=Decimal("8.77"),
        document_number="1004", document_date=date.today() - timedelta(days=24),
        bill_to="Tony Pipefitter",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        user_phone="123-456-7890",
        user_email="info@jobsyte.app",
        payment_method="Venmo @hammer-time-plumbing or check",
        business_address="123 Fake Street, Nowhereville, CO 00001",
        worksite_address="1 Blueprint Way, Constructia, CO 00100",
        notes="Progress billing: 50% at rough-in inspection, 50% at final.",
        created_at=_ago(days=24),
    )
    db.session.add(est_newcon)
    db.session.flush()

    li_supply = LineItem(id=uuid.uuid4(), parent_id=est_newcon.id, parent_type="estimate",
                         name="Supply Lines (PEX-A)", hourly_rate=Decimal("95.00"), sort_order=0)
    li_dwv = LineItem(id=uuid.uuid4(), parent_id=est_newcon.id, parent_type="estimate",
                      name="DWV (Drain/Waste/Vent)", hourly_rate=Decimal("95.00"), sort_order=1)
    li_manifold = LineItem(id=uuid.uuid4(), parent_id=est_newcon.id, parent_type="estimate",
                           name="Manifold & Connections", hourly_rate=Decimal("95.00"), sort_order=2)
    db.session.add_all([li_supply, li_dwv, li_manifold])
    db.session.flush()

    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_supply.id, entry_type="material",
                      name="3/4\" PEX-A tubing (500ft)", unit_price=Decimal("225.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_supply.id, entry_type="material",
                      name="1/2\" PEX-A tubing (300ft)", unit_price=Decimal("120.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_supply.id, entry_type="material",
                      name="Uponor fittings assortment", unit_price=Decimal("185.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_supply.id, entry_type="hours",
                      name="Run all supply lines", hours=Decimal("16"), sort_order=3),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_dwv.id, entry_type="material",
                      name="3\" PVC DWV pipe (100ft)", unit_price=Decimal("145.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_dwv.id, entry_type="material",
                      name="2\" PVC DWV pipe (60ft)", unit_price=Decimal("72.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_dwv.id, entry_type="material",
                      name="PVC fittings, cement, hangers", unit_price=Decimal("95.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_dwv.id, entry_type="hours",
                      name="Install all DWV + vent through roof", hours=Decimal("20"), sort_order=3),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_manifold.id, entry_type="material",
                      name="Uponor 12-port manifold", unit_price=Decimal("289.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_manifold.id, entry_type="material",
                      name="Manifold cabinet", unit_price=Decimal("65.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_manifold.id, entry_type="hours",
                      name="Mount manifold & connect all lines", hours=Decimal("6"), sort_order=2),
    ])
    db.session.flush()

    # Estimate 5: Sparks Restroom (smaller commercial job)
    est_sparks = Estimate(
        id=uuid.uuid4(), job_id=job_s_restroom.id,
        title="Ground Floor Restroom Fixture Refit",
        delivered=False, tax_rate=Decimal("8.77"),
        document_number="1006", document_date=date.today() - timedelta(days=5),
        bill_to="Paddy Sparks — Sparks Electric Co-op",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        worksite_address="888 Totally Real Rd, Exampletown, CO 00090",
        notes="Keep costs mid-range per client request.",
        created_at=_ago(days=5),
    )
    db.session.add(est_sparks)
    db.session.flush()

    li_sparks_fix = LineItem(id=uuid.uuid4(), parent_id=est_sparks.id, parent_type="estimate",
                             name="Fixture Swap-Out", hourly_rate=Decimal("90.00"), sort_order=0)
    li_sparks_ada = LineItem(id=uuid.uuid4(), parent_id=est_sparks.id, parent_type="estimate",
                             name="ADA Stall Expansion", hourly_rate=Decimal("90.00"), sort_order=1)
    db.session.add_all([li_sparks_fix, li_sparks_ada])
    db.session.flush()

    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_sparks_fix.id, entry_type="material",
                      name="Toilet (Toto Drake II)", unit_price=Decimal("389.00"), quantity=Decimal("2"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_sparks_fix.id, entry_type="material",
                      name="Pedestal sink + faucet combo", unit_price=Decimal("225.00"), quantity=Decimal("2"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_sparks_fix.id, entry_type="hours",
                      name="Remove old, install new fixtures", hours=Decimal("8"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_sparks_ada.id, entry_type="material",
                      name="ADA grab bars", unit_price=Decimal("55.00"), quantity=Decimal("3"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_sparks_ada.id, entry_type="material",
                      name="Partition panel relocation hardware", unit_price=Decimal("120.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_sparks_ada.id, entry_type="hours",
                      name="Expand stall, mount bars, verify clearances", hours=Decimal("5"), sort_order=2),
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
        bill_to="Bob Homeowner",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        user_phone="123-456-7890",
        payment_method="Venmo @hammer-time-plumbing or check",
        worksite_address="100 Imaginary Blvd, Faketown, CO 00010",
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
        bill_to="Maria Kitchenson",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        worksite_address="200 Madeup Lane, Nowhere, CO 00020",
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
        bill_to="Lisa Landlord — Landlord Rental Properties",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        worksite_address="300 Nonexistent Ave, Unit 4, Ghostville, CO 00030",
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

    # Invoice 4: Flores gas line (paid, completed job)
    inv_gas = Invoice(
        id=uuid.uuid4(), job_id=job_f_gas.id,
        title="Gas Line Rough-In",
        delivered=True, status="paid",
        tax_rate=Decimal("8.77"),
        document_number="2004", document_date=date.today() - timedelta(days=12),
        bill_to="Tony Pipefitter",
        company_name="Hammer Time Plumbing & Remodel",
        user_name="Jake Hammer",
        user_phone="123-456-7890",
        payment_method="Venmo @hammer-time-plumbing or check",
        worksite_address="1 Blueprint Way, Constructia, CO 00100",
        status_changed_at=_ago(days=9),
        created_at=_ago(days=12),
    )
    db.session.add(inv_gas)
    db.session.flush()

    li_gas = LineItem(id=uuid.uuid4(), parent_id=inv_gas.id, parent_type="invoice",
                      name="Gas Line Work", hourly_rate=Decimal("95.00"), sort_order=0)
    db.session.add(li_gas)
    db.session.flush()
    db.session.add_all([
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_gas.id, entry_type="material",
                      name="Black iron pipe + fittings", unit_price=Decimal("320.00"), quantity=Decimal("1"), sort_order=0),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_gas.id, entry_type="material",
                      name="CSST flex line (50ft)", unit_price=Decimal("185.00"), quantity=Decimal("1"), sort_order=1),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_gas.id, entry_type="material",
                      name="Gas shut-offs & connectors", unit_price=Decimal("75.00"), quantity=Decimal("1"), sort_order=2),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_gas.id, entry_type="hours",
                      name="Run lines, connect, pressure test", hours=Decimal("8"), sort_order=3),
        LineItemEntry(id=uuid.uuid4(), line_item_id=li_gas.id, entry_type="fee",
                      name="Gas permit fee", unit_price=Decimal("95.00"), quantity=Decimal("1"), sort_order=4),
    ])

    db.session.add_all([
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_gas.id, status="drafting", changed_at=_ago(days=12)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_gas.id, status="sent_awaiting_payment", changed_at=_ago(days=11)),
        InvoiceStatusHistory(id=uuid.uuid4(), invoice_id=inv_gas.id, status="paid", changed_at=_ago(days=9)),
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
    si_waterheater = SavedItem(
        id=uuid.uuid4(), user_id=user.id,
        name="Tank Water Heater Swap",
        notes="Remove existing tank water heater, install new 50-gal. Includes haul-away.",
        hourly_rate=Decimal("85.00"),
    )
    si_shutoff = SavedItem(
        id=uuid.uuid4(), user_id=user.id,
        name="Add Shut-Off Valve",
        notes="Install ball valve on supply line. Quarter-turn for easy access.",
        hourly_rate=Decimal("85.00"),
    )
    si_sump = SavedItem(
        id=uuid.uuid4(), user_id=user.id,
        name="Sump Pump Install",
        notes="Dig pit, set basin, install 1/3 HP sump pump with check valve and discharge.",
        hourly_rate=Decimal("85.00"),
    )
    db.session.add_all([si_toilet, si_faucet, si_disposal, si_waterheater, si_shutoff, si_sump])
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

    # Water heater swap entries
    db.session.add_all([
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_waterheater.id, entry_type="material",
                       name="50-gal gas water heater (Rheem)", unit_price=Decimal("649.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_waterheater.id, entry_type="material",
                       name="Flex connectors & gas valve", unit_price=Decimal("35.00"), quantity=Decimal("1"), sort_order=1),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_waterheater.id, entry_type="material",
                       name="Expansion tank", unit_price=Decimal("42.00"), quantity=Decimal("1"), sort_order=2),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_waterheater.id, entry_type="hours",
                       name="Remove old, install new, test", hours=Decimal("4"), sort_order=3),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_waterheater.id, entry_type="fee",
                       name="Haul-away old unit", unit_price=Decimal("50.00"), quantity=Decimal("1"), sort_order=4),
    ])

    # Shut-off valve entries
    db.session.add_all([
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_shutoff.id, entry_type="material",
                       name="1/2\" ball valve (brass)", unit_price=Decimal("14.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_shutoff.id, entry_type="material",
                       name="SharkBite fittings", unit_price=Decimal("9.50"), quantity=Decimal("2"), sort_order=1),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_shutoff.id, entry_type="hours",
                       name="Cut in and install valve", hours=Decimal("0.75"), sort_order=2),
    ])

    # Sump pump entries
    db.session.add_all([
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_sump.id, entry_type="material",
                       name="1/3 HP sump pump (Wayne CDU800)", unit_price=Decimal("169.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_sump.id, entry_type="material",
                       name="Sump basin (18\" dia)", unit_price=Decimal("45.00"), quantity=Decimal("1"), sort_order=1),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_sump.id, entry_type="material",
                       name="Check valve & discharge pipe", unit_price=Decimal("28.00"), quantity=Decimal("1"), sort_order=2),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_sump.id, entry_type="material",
                       name="Gravel (50 lb bag)", unit_price=Decimal("6.50"), quantity=Decimal("2"), sort_order=3),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=si_sump.id, entry_type="hours",
                       name="Dig pit, set basin, install pump", hours=Decimal("3"), sort_order=4),
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
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="material", name="Plumber's putty (14 oz)",
                       unit_price=Decimal("5.49"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="material", name="Copper pipe 1/2\" Type L (10ft)",
                       unit_price=Decimal("18.50"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="material", name="PEX crimp ring (bag of 25)",
                       unit_price=Decimal("8.99"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="fee", name="Emergency call-out (weekends)",
                       unit_price=Decimal("150.00"), quantity=Decimal("1"), sort_order=0),
        SavedItemEntry(id=uuid.uuid4(), saved_item_id=None, user_id=user.id,
                       entry_type="fee", name="Permit filing fee (residential)",
                       unit_price=Decimal("125.00"), quantity=Decimal("1"), sort_order=0),
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
        # New site time entries
        TimeEntry(id=uuid.uuid4(), job_id=job_f_roughin.id, user_id=user.id,
                  hours=Decimal("8"), worked_at=_ago(days=22), note="Underground rough-in — slabs"),
        TimeEntry(id=uuid.uuid4(), job_id=job_f_roughin.id, user_id=user.id,
                  hours=Decimal("8"), worked_at=_ago(days=21), note="Supply lines 1st floor"),
        TimeEntry(id=uuid.uuid4(), job_id=job_f_roughin.id, user_id=member.id,
                  hours=Decimal("8"), worked_at=_ago(days=22), note="Digging & pipe laying"),
        TimeEntry(id=uuid.uuid4(), job_id=job_f_gas.id, user_id=user.id,
                  hours=Decimal("6"), worked_at=_ago(days=15), note="Gas lines run"),
        TimeEntry(id=uuid.uuid4(), job_id=job_f_gas.id, user_id=user.id,
                  hours=Decimal("2"), worked_at=_ago(days=13), note="Pressure test & inspection"),
        TimeEntry(id=uuid.uuid4(), job_id=job_s_restroom.id, user_id=user.id,
                  hours=Decimal("4"), worked_at=_ago(days=5), note="Demo old fixtures"),
        TimeEntry(id=uuid.uuid4(), job_id=job_g_fixtures.id, user_id=user.id,
                  hours=Decimal("5"), worked_at=_ago(days=3), note="Install sink & disposal"),
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
    print(f"    Job Sites: 7")
    print(f"    Jobs: 15 (4 completed, 6 in_progress, 5 pending)")
    print(f"    Contacts: 10")
    print(f"    Estimates: 5 (with detailed line items)")
    print(f"    Invoices: 4 (2 paid, 1 sent, 1 waiting)")
    print(f"    Notes: 8 (markdown)")
    print(f"    Saved Items: 6 (+ 9 standalone materials/fees)")
    print(f"    Time Entries: 17 (including 1 active clock-in)")


if __name__ == "__main__":
    main()
