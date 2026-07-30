"""Tests for ContactService — CRUD, primary contact resolution, inheritance."""

import pytest

from app.services.contact_service import ContactService, NotFoundError


class TestContactCRUD:
    """Test basic contact create/read/update/delete."""

    def test_create_contact(self, app_context, db_session):
        """Create a contact with all fields."""
        service = ContactService()
        contact = service.create_contact(
            name="Jane Doe",
            phone="555-9876",
            email="jane@example.com",
            mailing_address="456 Elm St",
            notes="Preferred contact",
        )
        assert contact.name == "Jane Doe"
        assert contact.phone == "555-9876"
        assert contact.email == "jane@example.com"
        assert contact.mailing_address == "456 Elm St"

    def test_update_contact(self, app_context, create_contact):
        """Update contact fields."""
        contact = create_contact(name="Original Name")
        service = ContactService()

        updated = service.update_contact(str(contact.id), name="Updated Name", phone="555-0000")
        assert updated.name == "Updated Name"
        assert updated.phone == "555-0000"

    def test_delete_contact(self, app_context, create_contact):
        """Delete a contact."""
        contact = create_contact(name="To Delete")
        service = ContactService()

        service.delete_contact(str(contact.id))
        with pytest.raises(NotFoundError):
            service.get_contact(str(contact.id))

    def test_get_nonexistent_contact_raises(self, app_context, db_session):
        """Getting a nonexistent contact raises NotFoundError."""
        service = ContactService()
        with pytest.raises(NotFoundError):
            service.get_contact("00000000-0000-0000-0000-000000000000")


class TestJobSiteContacts:
    """Test contact association with job sites."""

    def test_add_contact_to_job_site(self, app_context, sample_job_hierarchy, create_contact):
        """Add a contact to a job site."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        contact = create_contact(name="Site Contact")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(contact.id))
        contacts = service.get_contacts_for_job_site(str(site.id), str(user.id))
        assert len(contacts) == 1
        assert contacts[0].name == "Site Contact"

    def test_set_primary_contact_on_site(self, app_context, sample_job_hierarchy, create_contact):
        """Set a primary contact on a job site."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        contact = create_contact(name="Primary")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(contact.id))
        service.set_primary_for_job_site(str(site.id), str(user.id), str(contact.id))

        # Verify by reloading the site
        from app.models import JobSite
        from app.extensions import db as _db
        _db.session.expire(site)
        reloaded = JobSite.query.get(site.id)
        assert str(reloaded.primary_contact_id) == str(contact.id)

    def test_nonexistent_site_raises(self, app_context, sample_job_hierarchy, create_contact):
        """Adding contact to nonexistent site raises NotFoundError."""
        user = sample_job_hierarchy["user"]
        contact = create_contact()
        service = ContactService()

        with pytest.raises(NotFoundError):
            service.add_contact_to_job_site(
                "00000000-0000-0000-0000-000000000000",
                str(user.id), str(contact.id),
            )


class TestJobContacts:
    """Test contact association with jobs."""

    def test_add_contact_to_job(self, app_context, sample_job_hierarchy, create_contact):
        """Add a contact to a job."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        contact = create_contact(name="Job Contact")
        service = ContactService()

        service.add_contact_to_job(str(job.id), str(user.id), str(contact.id))
        contacts = service.get_contacts_for_job(str(job.id), str(user.id))

        # Should include the direct contact
        direct = [c for c in contacts if not c["inherited"]]
        assert len(direct) == 1
        assert direct[0]["contact"].name == "Job Contact"

    def test_auto_primary_on_first_contact(self, app_context, sample_job_hierarchy, create_contact):
        """First contact added to a job is auto-set as primary."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        contact = create_contact(name="Auto Primary")
        service = ContactService()

        service.add_contact_to_job(str(job.id), str(user.id), str(contact.id))

        from app.models import Job
        from app.extensions import db as _db
        _db.session.expire(job)
        reloaded = Job.query.get(job.id)
        assert str(reloaded.primary_contact_id) == str(contact.id)


class TestContactInheritance:
    """Test contact inheritance from job sites to jobs."""

    def test_job_inherits_site_contacts(self, app_context, sample_job_hierarchy, create_contact):
        """Job shows inherited contacts from its parent site."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        site_contact = create_contact(name="Site Level")
        service = ContactService()

        # Add contact to site only
        service.add_contact_to_job_site(str(site.id), str(user.id), str(site_contact.id))

        # Job should see it as inherited
        contacts = service.get_contacts_for_job(str(job.id), str(user.id))
        inherited = [c for c in contacts if c["inherited"]]
        assert len(inherited) == 1
        assert inherited[0]["contact"].name == "Site Level"

    def test_direct_contacts_shown_before_inherited(self, app_context, sample_job_hierarchy, create_contact):
        """Direct job contacts appear before inherited site contacts."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        site_contact = create_contact(name="From Site")
        job_contact = create_contact(name="Direct")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(site_contact.id))
        service.add_contact_to_job(str(job.id), str(user.id), str(job_contact.id))

        contacts = service.get_contacts_for_job(str(job.id), str(user.id))
        assert contacts[0]["contact"].name == "Direct"
        assert contacts[0]["inherited"] is False
        assert contacts[1]["contact"].name == "From Site"
        assert contacts[1]["inherited"] is True

    def test_shared_contact_not_duplicated(self, app_context, sample_job_hierarchy, create_contact):
        """A contact on both site and job isn't shown twice."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        shared = create_contact(name="Shared")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(shared.id))
        service.add_contact_to_job(str(job.id), str(user.id), str(shared.id))

        contacts = service.get_contacts_for_job(str(job.id), str(user.id))
        # Should only appear once (as direct, not inherited)
        assert len(contacts) == 1
        assert contacts[0]["inherited"] is False


class TestEffectivePrimaryContact:
    """Test primary contact resolution logic."""

    def test_job_primary_is_direct(self, app_context, sample_job_hierarchy, create_contact):
        """Job's own primary contact takes precedence."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        job_primary = create_contact(name="Job Primary")
        site_primary = create_contact(name="Site Primary")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(site_primary.id))
        service.set_primary_for_job_site(str(site.id), str(user.id), str(site_primary.id))
        service.add_contact_to_job(str(job.id), str(user.id), str(job_primary.id))
        service.set_primary_for_job(str(job.id), str(user.id), str(job_primary.id))

        result = service.get_effective_primary_contact(str(job.id), str(user.id))
        assert result["contact"].name == "Job Primary"
        assert result["source"] == "direct"

    def test_site_primary_is_inherited(self, app_context, sample_job_hierarchy, create_contact):
        """Falls back to site primary when job has none."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        site_primary = create_contact(name="Site Primary")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(site_primary.id))
        service.set_primary_for_job_site(str(site.id), str(user.id), str(site_primary.id))

        result = service.get_effective_primary_contact(str(job.id), str(user.id))
        assert result["contact"].name == "Site Primary"
        assert result["source"] == "inherited"

    def test_single_contact_is_auto(self, app_context, sample_job_hierarchy, create_contact):
        """Single visible contact auto-resolves as primary."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        only_contact = create_contact(name="Only One")
        service = ContactService()

        service.add_contact_to_job_site(str(site.id), str(user.id), str(only_contact.id))

        result = service.get_effective_primary_contact(str(job.id), str(user.id))
        assert result["contact"].name == "Only One"
        assert result["source"] == "auto"

    def test_no_contacts_returns_none(self, app_context, sample_job_hierarchy):
        """No contacts at all returns None."""
        user = sample_job_hierarchy["user"]
        job = sample_job_hierarchy["job"]
        service = ContactService()

        result = service.get_effective_primary_contact(str(job.id), str(user.id))
        assert result is None

    def test_multiple_contacts_no_primary_returns_none(self, app_context, sample_job_hierarchy, create_contact):
        """Multiple contacts with no primary set returns None."""
        user = sample_job_hierarchy["user"]
        site = sample_job_hierarchy["site"]
        job = sample_job_hierarchy["job"]
        service = ContactService()

        # Add two contacts to the site without setting a primary
        c1 = create_contact(name="Contact 1")
        c2 = create_contact(name="Contact 2")
        service.add_contact_to_job_site(str(site.id), str(user.id), str(c1.id))
        service.add_contact_to_job_site(str(site.id), str(user.id), str(c2.id))

        result = service.get_effective_primary_contact(str(job.id), str(user.id))
        assert result is None
